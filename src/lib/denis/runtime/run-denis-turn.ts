import { apiError } from "@/lib/api-response";
import { executeChatTurn } from "@/lib/ai/execute-chat-turn";
import {
  assertSufficientCredits,
  finalizeTurnMetering,
  maybeEnqueueLowBalanceAlert,
  refreshOrgAiOpsProjection,
  resolveAiTurnOrg,
} from "@/lib/denis/commercial";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { buildDenisTurnContext } from "@/lib/denis/runtime/build-turn-context";
import {
  kernelTimelineEnabled,
  resolveEffectiveRollout,
  resolveGuestLegacyPath,
  shouldRunShadowDiff,
} from "@/lib/denis/config/rollout";
import { diffShadowTurn } from "@/lib/denis/runtime/shadow-diff";
import {
  guestIntentTierFromReflex,
  resolveTurnIntent,
} from "@/lib/denis/runtime/map-legacy-intent";
import { logger } from "@/lib/logger";
import { persistDenisTurnTimeline } from "@/lib/denis/runtime/persist-turn-timeline";
import {
  buildNarrationFacts,
  resolveTurnQuickReplies,
  sanitizeNarrationOutput,
} from "@/lib/denis/runtime/narrate";
import { resolveTurnNarrationMessage } from "@/lib/denis/runtime/narrate/resolve-turn-narration";
import {
  extractOrderSlots,
  shouldRunSlotExtract,
} from "@/lib/denis/runtime/perceive";
import { executeActPhase } from "@/lib/denis/runtime/act";
import {
  elapsedMs,
  emptyTurnTimings,
  logDenisTurnObservability,
} from "@/lib/denis/runtime/turn-observability";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { initDraftFromStorage } from "@/lib/ai/ordering/draft-engine";
import { applyPostLlmOrdering } from "@/lib/ai/ordering/kernel-ordering-bridge";
import type { AiStructuredResponse } from "@/lib/ai/types";
import {
  mergeKernelOrderingIntoTurn,
  persistKernelOrderingDraft,
} from "@/lib/denis/runtime/act/apply-kernel-ordering";
import type { DenisTurnRunInput } from "@/lib/denis/runtime/turn-types";
import { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { formatVoiceTurnApiResponse } from "@/lib/denis/surfaces/voice/format-voice-response";
import { parseDenisVoiceBody } from "@/lib/denis/surfaces/voice/parse-voice-turn";
import type {
  PerceptionChannel,
  TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
import { createAdminClient } from "@/lib/supabase/admin";

function isSupportedTurnChannel(
  channel: DenisTurnRunInput["channel"]
): channel is "chat" | "voice" {
  return channel === "chat" || channel === "voice";
}

type LegacyChatPayload = {
  data?: {
    sessionId?: string;
    message?: string;
    intent?: string;
    recommendations?: Array<{ productName?: string; name?: string }>;
    cartActions?: Array<{ productName: string; quantity?: number }>;
    quickReplies?: string[];
    submitOrder?: boolean;
    creditsRemaining?: number;
    creditsCharged?: number;
    deferredOrdering?: AiStructuredResponse;
  };
};

/**
 * Denis PPAN+ entry — perceive → plan → legacy narrate → lint → timeline (M7–M9).
 */
export async function runDenisTurn(input: DenisTurnRunInput): Promise<Response> {
  if (!isSupportedTurnChannel(input.channel)) {
    return apiError("Unsupported channel.", 400);
  }

  const parsed =
    input.channel === "voice"
      ? parseDenisVoiceBody(input.rawBody)
      : parseDenisChatBody(input.rawBody);
  if (!parsed.ok) {
    return parsed.response;
  }

  const admin = createAdminClient();
  const traceId = createTurnTraceId();
  const turnStarted = performance.now();
  const timings = emptyTurnTimings();
  let shadowParityScore: number | undefined;

  const orgResult = await resolveAiTurnOrg(admin, {
    locationId: parsed.data.locationId,
    tableId: parsed.data.tableId,
    sessionToken: parsed.data.sessionToken,
  });
  if (!orgResult.ok) {
    return apiError(orgResult.error, orgResult.status);
  }

  const creditCheck = await assertSufficientCredits(admin, orgResult.data.orgId);
  if (!creditCheck.ok) {
    return apiError("insufficient_credits", 402);
  }

  const ctxStarted = performance.now();
  const ctx = await buildDenisTurnContext(admin, parsed.data);
  timings.contextMs = elapsedMs(ctxStarted);

  if (input.channel === "voice" && !ctx.config.surfaces.voiceEnabled) {
    return apiError("Voice is not enabled for this location.", 403);
  }

  const timelineSurface: TurnEnvelope["surface"] =
    input.channel === "voice" ? "voice" : "chat";
  const perceptionChannel: PerceptionChannel =
    input.channel === "voice" ? "voice.transcript" : "chat.message";

  const reflexTurn = planTurnWithReflex({
    config: ctx.config,
    message: parsed.data.message,
    flowNodeId: ctx.flowNodeId,
    cartState: ctx.aiCartState,
    manualCartDraft: ctx.manualCartDraft,
    peerManualCartDraft: ctx.peerManualCartDraft,
    foodUpsellAsked: ctx.foodUpsellAsked,
    skipUpsell: ctx.opsEffects?.skipUpsell ?? false,
  });

  const slotExtract = shouldRunSlotExtract(ctx.config, reflexTurn)
    ? await extractOrderSlots({
        utterance: parsed.data.message,
        language: parsed.data.language,
        config: ctx.config,
      })
    : null;

  const legacyStarted = performance.now();
  const legacyResponse = await executeChatTurn({
    ...parsed.data,
    legacyOrderingEnabled: ctx.config.ordering.legacyOrderingEnabled,
  });
  timings.legacyMs = elapsedMs(legacyStarted);
  if (legacyResponse.status !== 200) {
    return legacyResponse;
  }

  const payload = (await legacyResponse.json()) as LegacyChatPayload;
  const data = payload.data;

  if (!data?.message) {
    return legacyResponse;
  }

  if (
    !ctx.config.ordering.legacyOrderingEnabled &&
    data.deferredOrdering &&
    data.sessionId
  ) {
    const { data: sessionRow, error: sessionError } = await admin
      .from("ai_sessions")
      .select("order_draft, messages")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (!sessionError && sessionRow) {
      try {
        const menuPayload = await getCachedMenuForLocation(parsed.data.locationId, {
          useEnglish: false,
        });
        const catalog = {
          menuText: menuPayload.menuText,
          productMap: menuPayload.productMap,
          catalog: menuPayload.catalog,
          currency: menuPayload.currency,
          cachedAt: menuPayload.cachedAt,
        };
        const priorMessages =
          (sessionRow.messages as Array<{ role: string; content: string }>) ??
          [];

        const kernel = applyPostLlmOrdering({
          userMessage: parsed.data.message,
          allowOrdering: true,
          orderDraft: initDraftFromStorage(sessionRow.order_draft),
          catalog,
          structured: data.deferredOrdering,
          priorMessages,
          language: parsed.data.language,
        });

        await persistKernelOrderingDraft(admin, data.sessionId, kernel.draft);

        const merged = mergeKernelOrderingIntoTurn(data.message, kernel);
        data.message = merged.message;
        data.cartActions = merged.cartActions;
        data.quickReplies = merged.quickReplies;
        data.intent = merged.intent;
        data.submitOrder = merged.submitOrder;
      } catch (error) {
        logger.warn("Kernel ordering bridge failed", {
          traceId,
          sessionId: data.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  let actPhase: Awaited<ReturnType<typeof executeActPhase>> = {
    enabled: false,
    dryRun: true,
    results: [],
  };
  if (ctx.config.ordering.actLayerEnabled) {
    let catalog;
    const needsCatalog =
      ctx.config.ordering.actSubmitEnabled &&
      !ctx.config.ordering.actDryRun &&
      Boolean(data.submitOrder);
    if (needsCatalog) {
      try {
        catalog = await getCachedMenuForLocation(parsed.data.locationId);
      } catch {
        catalog = undefined;
      }
    }

    const actStarted = performance.now();
    actPhase = await executeActPhase({
      config: ctx.config,
      reflexTurn,
      aiSessionId: data.sessionId,
      tableToken: parsed.data.sessionToken,
      sessionToken: parsed.data.sessionToken,
      deviceFingerprint: parsed.data.deviceFingerprint ?? undefined,
      cartDraft: ctx.aiCartState.draft,
      catalog,
      legacySubmitOrder: data.submitOrder,
    });
    timings.actMs = elapsedMs(actStarted);
  }

  const rollout = resolveEffectiveRollout(ctx.config);
  const guestUsesLegacy = resolveGuestLegacyPath(rollout.mode, {
    cohortKey: parsed.data.sessionToken,
    canaryPercent: ctx.config.rollout.canaryPercent,
  });

  const narrationFacts = buildNarrationFacts({
    config: ctx.config,
    language: parsed.data.language,
    reflexTurn,
    flowNodeId: ctx.flowNodeId,
    guestMemory: ctx.guestMemory,
    cartActions: data.cartActions,
    recommendations: data.recommendations,
    venueOps: ctx.venueOps,
    opsEffects: ctx.opsEffects,
  });

  const narrateStarted = performance.now();
  const resolvedNarration = await resolveTurnNarrationMessage({
    legacyMessage: data.message,
    facts: narrationFacts,
    config: ctx.config,
    rolloutMode: rollout.mode,
  });
  const narration = sanitizeNarrationOutput(
    resolvedNarration.draftMessage,
    narrationFacts
  );
  const quickReplies = resolveTurnQuickReplies({
    reflexTurn,
    facts: narrationFacts,
    narration,
    legacyQuickReplies: data.quickReplies,
    language: parsed.data.language,
  });
  const guestMessage =
    guestUsesLegacy && !resolvedNarration.usedDenisNarrator
      ? data.message
      : narration.message;
  timings.narrateMs = elapsedMs(narrateStarted);

  if (shouldRunShadowDiff(rollout.mode)) {
    const shadowDiff = diffShadowTurn({
      legacy: {
        intent: data.intent,
        message: data.message,
        cartActionCount: data.cartActions?.length ?? 0,
        submitOrder: data.submitOrder,
      },
      denis: {
        topGoal: reflexTurn.plan.topGoal?.type ?? null,
        flowNodeId: reflexTurn.plan.transition.toNodeId,
        skillIds: reflexTurn.plan.skills.map((skill) => skill.id),
        hasConflict: reflexTurn.conflict?.hasConflict ?? false,
        lintPassed: narration.lintPassed,
        intent: reflexTurn.reflex?.intent ?? null,
        slotItemCount: slotExtract?.items.length ?? 0,
      },
    });
    logger.info("Denis shadow diff", {
      traceId,
      rolloutMode: rollout.mode,
      parityScore: shadowDiff.parityScore,
      mismatches: shadowDiff.mismatches,
      slotItemCount: slotExtract?.items.length ?? 0,
      slotTier: slotExtract?.tier ?? null,
    });
    shadowParityScore = shadowDiff.parityScore;
  }

  if (data.sessionId && kernelTimelineEnabled(rollout.mode)) {
    const timelineStarted = performance.now();
    const intent = resolveTurnIntent(
      reflexTurn.reflex?.intent,
      data.intent ?? "UNKNOWN"
    );

    await persistDenisTurnTimeline(admin, {
      aiSessionId: data.sessionId,
      locationId: parsed.data.locationId,
      traceId,
      guestMessage: parsed.data.message,
      assistantMessage: guestMessage,
      intent,
      intentTier: guestIntentTierFromReflex(reflexTurn.usedT0),
      narrationTier: narration.tier,
      reflexTurn,
      channel: perceptionChannel,
      timelineSurface,
    });

    if (slotExtract && slotExtract.items.length > 0) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId: data.sessionId,
        eventType: "slot.extracted",
        traceId,
        payload: {
          type: "slot.extracted",
          tier: slotExtract.tier,
          itemCount: slotExtract.items.length,
          items: slotExtract.items,
          unmappedSpans: slotExtract.unmappedSpans,
        },
      });
    }

    for (const skillResult of actPhase.results) {
      await appendDenisTimelineEvent(admin, {
        aiSessionId: data.sessionId,
        eventType: "skill.executed",
        traceId,
        payload: {
          type: "skill.executed",
          skillId: skillResult.skillId,
          riskClass: skillResult.riskClass,
          dryRun: skillResult.dryRun,
          ok: skillResult.ok,
          error: skillResult.error ?? null,
          detail: skillResult.detail ?? null,
        },
      });
    }
    timings.timelineMs = elapsedMs(timelineStarted);
  }

  let creditsRemaining =
    data.creditsRemaining ?? creditCheck.balanceAfter;
  const creditsCharged = data.creditsCharged ?? 0;

  if (data.sessionId && creditsCharged > 0) {
    const meteringStarted = performance.now();
    const metering = await finalizeTurnMetering(admin, {
      orgId: orgResult.data.orgId,
      aiSessionId: data.sessionId,
      traceId,
    });

    if (metering.ok) {
      creditsRemaining = metering.balanceAfter;
      await maybeEnqueueLowBalanceAlert(admin, {
        orgId: orgResult.data.orgId,
        locationId: parsed.data.locationId,
        balanceAfter: metering.balanceAfter,
        traceId,
      });
      void refreshOrgAiOpsProjection(admin, orgResult.data.orgId).catch(
        (error) => {
          logger.warn("Denis turn org_ai_ops refresh failed", {
            orgId: orgResult.data.orgId,
            traceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      );
    } else {
      logger.error("Denis turn metering finalize failed", {
        traceId,
        aiSessionId: data.sessionId,
        orgId: orgResult.data.orgId,
        code: metering.code,
      });
    }
    timings.meteringMs = elapsedMs(meteringStarted);
  }

  timings.totalMs = elapsedMs(turnStarted);

  logDenisTurnObservability({
    traceId,
    locationId: parsed.data.locationId,
    channel: input.channel,
    rolloutMode: rollout.mode,
    guestUsesLegacy,
    narrationTier: narration.tier,
    lintPassed: narration.lintPassed,
    creditsCharged,
    actDryRun: actPhase.dryRun,
    actEnabled: actPhase.enabled,
    shadowParityScore,
    timings,
  });

  const responseData = {
    message: guestMessage,
    recommendations: data.recommendations,
    cartActions: data.cartActions,
    quickReplies,
    intent: data.intent,
    submitOrder: data.submitOrder,
    creditsRemaining,
    sessionId: data.sessionId,
  };

  const responseMeta = {
    traceId,
    channel: input.channel,
    flowNodeId: reflexTurn.plan.transition.toNodeId,
    topGoal: reflexTurn.plan.topGoal?.type ?? null,
    conflictPrompt: reflexTurn.conflict?.guestPrompt ?? null,
    narrationTier: narration.tier,
    lintPassed: narration.lintPassed,
    usedNarrationFallback: narration.usedFallback,
    rolloutMode: rollout.mode,
    partyMode: ctx.config.party.mode,
    partyDeviceCount: ctx.party?.activeDeviceCount ?? 0,
    isPrimaryDevice: ctx.party?.isCurrentDevicePrimary ?? false,
    sharedAiSessionId: ctx.party?.sharedAiSessionId ?? null,
    operatingMode: ctx.venueOps?.operatingMode,
    kdsStress: ctx.venueOps?.kdsStress,
  };

  if (input.channel === "voice") {
    return formatVoiceTurnApiResponse(responseData, responseMeta, {
      speakText: guestMessage,
      ttsRecommended: ctx.config.surfaces.voiceTtsEnabled,
    });
  }

  return formatChatTurnApiResponse(responseData, responseMeta);
}
