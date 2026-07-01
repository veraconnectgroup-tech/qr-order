import { getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import {
  appendMindBeliefsCompiled,
  compileBeliefs,
  CORE_BELIEF_KEYS,
} from "@/lib/denis/cognition/beliefs";
import { resolveRuntimeProfile } from "@/lib/denis/cognition/resolve-runtime-profile";
import { applyFrustrationRecoveryEscalation } from "@/lib/denis/runtime/apply-frustration-recovery";
import {
  kernelTimelineEnabled,
  resolveEffectiveRollout,
} from "@/lib/denis/config/rollout";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { appendMindFoldCompleted } from "@/lib/denis/loop/append-fold-completed";
import { maybeAppendMentalModelUpdated } from "@/lib/denis/cognition/mental-model/append-mental-model-event";
import {
  tryResolvePendingSlotAct,
  sessionDraftHasPendingSlot,
} from "@/lib/denis/runtime/act/resolve-pending-slot-act";
import {
  extractOrderSlots,
  shouldRunSlotExtract,
} from "@/lib/denis/runtime/perceive";
import {
  buildPendingSlotActPerceiveResult,
  runTdePerceive,
} from "@/lib/denis/runtime/phases/run-tde-perceive";
import {
  resolveFrustrationRecoveryForTurn,
  voiceDisabledResponse,
} from "@/lib/denis/runtime/phases/prepare-turn-context";
import type {
  PerceiveChatPayload,
  PerceiveTurnResult,
  PreparedTurnContext,
  TdePerceiveResult,
} from "@/lib/denis/runtime/phases/phase-types";
import type { DenisChatBody } from "@/lib/denis/runtime/turn-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PerceiveTurnOutcome =
  | { ok: true; result: PerceiveTurnResult }
  | { ok: false; response: Response };

export async function perceiveTurn(input: {
  admin: SupabaseClient;
  parsed: DenisChatBody;
  prepared: PreparedTurnContext;
  orgId: string;
  traceId: string;
  channel: "chat" | "voice";
}): Promise<PerceiveTurnOutcome> {
  const { ctx } = input.prepared;
  const { chatAiSessionId } = input.prepared;

  const perceiveBody =
    chatAiSessionId != null
      ? { ...input.parsed, sessionId: chatAiSessionId }
      : input.parsed;

  const beliefGraph = ctx.tableSessionState
    ? compileBeliefs({
        state: ctx.tableSessionState,
        guestMessage: input.parsed.message,
        sessionLanguage: input.parsed.language,
        rhythm: ctx.rhythmContext,
      })
    : null;

  if (
    ctx.draftAiSessionId &&
    ctx.foldMeta &&
    kernelTimelineEnabled(resolveEffectiveRollout(ctx.config).mode)
  ) {
    const mindWrites: Promise<void>[] = [
      appendMindFoldCompleted(input.admin, {
        aiSessionId: ctx.draftAiSessionId,
        traceId: input.traceId,
        meta: ctx.foldMeta,
      }),
    ];

    if (ctx.tableSessionState) {
      mindWrites.push(
        maybeAppendMentalModelUpdated(input.admin, {
          aiSessionId: ctx.draftAiSessionId,
          traceId: input.traceId,
          timeline: ctx.tableSessionState.timeline,
          mental: ctx.tableSessionState.mental,
          contextHash: ctx.foldMeta.truthHash,
        }).then(() => undefined)
      );
    }

    if (beliefGraph) {
      mindWrites.push(
        appendMindBeliefsCompiled(input.admin, {
          aiSessionId: ctx.draftAiSessionId,
          traceId: input.traceId,
          graph: beliefGraph,
          truthHash: ctx.foldMeta.truthHash,
        })
      );
    }

    await Promise.all(mindWrites);
  }

  if (input.channel === "voice" && !ctx.config.surfaces.voiceEnabled) {
    return { ok: false, response: voiceDisabledResponse() };
  }

  const reflexTurn = planTurnWithReflex({
    config: ctx.config,
    message: input.parsed.message,
    flowNodeId: ctx.flowNodeId,
    cartState: ctx.aiCartState,
    manualCartDraft: ctx.manualCartDraft,
    peerManualCartDraft: ctx.peerManualCartDraft,
    foodUpsellAsked: ctx.foodUpsellAsked,
    skipUpsell: ctx.opsEffects?.skipUpsell ?? false,
    structuredIntent: input.parsed.structuredIntent,
    handoffPaymentMethod: input.parsed.handoffPaymentMethod,
    pendingSlot: ctx.tableSessionState?.conversation.pendingSlot
      ? { kind: ctx.tableSessionState.conversation.pendingSlot }
      : null,
    hasOpenOrders:
      ctx.tableSessionState?.commerce.orders.some(
        (order) =>
          order.status !== "delivered" && order.status !== "cancelled"
      ) ?? false,
  });

  const slotExtractPromise = shouldRunSlotExtract(ctx.config, reflexTurn)
    ? extractOrderSlots({
        utterance: input.parsed.message,
        language: input.parsed.language,
        config: ctx.config,
      })
    : Promise.resolve(null);

  const rollout = resolveEffectiveRollout(ctx.config);
  const timelineEnabled = kernelTimelineEnabled(rollout.mode);

  const pendingSlot = beliefGraph
    ? getBeliefValue<string>(beliefGraph, CORE_BELIEF_KEYS.commercePendingSlot)
    : null;
  const aiSessionId = chatAiSessionId ?? null;
  const { profile } = resolveRuntimeProfile(ctx.config);

  const pendingDraftPromise =
    aiSessionId != null
      ? sessionDraftHasPendingSlot(input.admin, aiSessionId)
      : Promise.resolve(false);

  const [slotExtract, hasPendingDraft] = await Promise.all([
    slotExtractPromise,
    pendingDraftPromise,
  ]);

  const frustrationRecovery = resolveFrustrationRecoveryForTurn({
    ctx,
    language: input.parsed.language,
  });

  if (
    frustrationRecovery.length > 0 &&
    aiSessionId &&
    input.parsed.tableId
  ) {
    const tableName = ctx.tableSessionState?.table?.name ?? "Sto";
    void applyFrustrationRecoveryEscalation(input.admin, {
      actions: frustrationRecovery,
      config: ctx.config,
      locationId: input.parsed.locationId,
      tableId: input.parsed.tableId,
      tableName,
      aiSessionId,
      sessionToken: input.parsed.sessionToken ?? null,
      traceId: input.traceId,
    }).catch(() => undefined);
  }

  const perceiveStarted = performance.now();
  let perceiveResult: TdePerceiveResult;

  if ((pendingSlot || hasPendingDraft) && aiSessionId) {
    const slotAct = await tryResolvePendingSlotAct({
      admin: input.admin,
      sessionId: aiSessionId,
      locationId: input.parsed.locationId,
      userMessage: input.parsed.message,
      language: input.parsed.language,
      pendingSlot: pendingSlot ?? "serve_size",
    });

    if (slotAct.resolved) {
      perceiveResult = buildPendingSlotActPerceiveResult(
        slotAct,
        ctx.opsEffects?.skipUpsell ?? false,
        profile.tier
      );
    } else {
      perceiveResult = await runTdePerceive({
        admin: input.admin,
        body: perceiveBody,
        ctx,
        reflexTurn,
        beliefs: beliefGraph ?? { beliefs: [] },
        timelineEnabled,
        orgId: input.orgId,
        frustrationRecovery,
        forceT0Only: ctx.healthOverrides?.forceT0Only,
      });
    }
  } else {
    perceiveResult = await runTdePerceive({
      admin: input.admin,
      body: perceiveBody,
      ctx,
      reflexTurn,
      beliefs: beliefGraph ?? { beliefs: [] },
      timelineEnabled,
      orgId: input.orgId,
      frustrationRecovery,
      forceT0Only: ctx.healthOverrides?.forceT0Only,
    });
  }

  const legacyMs = performance.now() - perceiveStarted;
  const perceiveResponse = perceiveResult.response;
  if (perceiveResponse.status !== 200) {
    return { ok: false, response: perceiveResponse };
  }

  const payload = (await perceiveResponse.json()) as PerceiveChatPayload;
  const data = payload.data;

  if (!data?.message?.trim() && !reflexTurn.handoffCommand) {
    return { ok: false, response: perceiveResponse };
  }
  if (!data) {
    return { ok: false, response: perceiveResponse };
  }

  const timelineAiSessionId = chatAiSessionId ?? data.sessionId ?? null;

  const t0ConfirmSubmit =
    reflexTurn.reflex?.intent === "CONFIRM" &&
    reflexTurn.plan.skills.some((skill) => skill.id === "order.submit");

  if (
    t0ConfirmSubmit ||
    perceiveResult.turnPlan.reason === "commerce.confirm.reflex_submit"
  ) {
    data.submitOrder = true;
  }

  return {
    ok: true,
    result: {
      ctx,
      perceiveResult,
      perceivePayload: payload,
      perceiveData: data,
      beliefGraph,
      reflexTurn,
      slotExtract,
      timelineEnabled,
      rolloutMode: rollout.mode,
      pendingSlot: pendingSlot ?? null,
      aiSessionId,
      timelineAiSessionId,
      perceiveBody,
      profileTier: profile.tier,
      frustrationRecovery,
      legacyMs,
    },
  };
}
