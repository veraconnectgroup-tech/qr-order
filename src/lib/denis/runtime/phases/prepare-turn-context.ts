import { buildDenisTurnContext } from "@/lib/denis/runtime/build-turn-context";
import { mergeTableSessionObligation } from "@/lib/denis/cognition/waiter";
import { resolveRecoveryActionsForTurn } from "@/lib/denis/runtime/resolve-turn-recovery";
import {
  applyDegradationTransition,
  applyHealthStateTransition,
  buildHealthOpsPatch,
  degradationDenisOffline,
  degradationForcesT0Only,
  degradationGuestOfflineMessage,
  degradationOpsPatch,
  degradationReducesProactive,
  evaluateDenisHealth,
  healthMetricsToDegradationInput,
  loadDenisHealthMetrics,
  markSessionTurnPending,
  recordHealthTurnSample,
  shouldEmitHealthAlert,
  shouldForceT0Only,
  shouldReduceProactiveFrequency,
} from "@/lib/denis/monitoring";
import { resolveDegradationFallbackTurn } from "@/lib/denis/config/degradation-fallback-intents";
import type { PreparedTurnContext } from "@/lib/denis/runtime/phases/phase-types";
import { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
import { formatVoiceTurnApiResponse } from "@/lib/denis/surfaces/voice/format-voice-response";
import { resolveCanonicalChatAiSessionId } from "@/lib/denis/venue/party";
import { elapsedMs } from "@/lib/denis/runtime/turn-observability";
import { logger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";
import type { DenisChatBody, DenisTurnContext, DenisTurnMeta } from "@/lib/denis/runtime/turn-types";
import { maybeBackfillPlacementCart } from "@/lib/denis/runtime/phases/turn-cart-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PrepareTurnContextResult =
  | { ok: true; prepared: PreparedTurnContext }
  | { ok: false; response: Response };

export function resolveFrustrationRecoveryForTurn(input: {
  ctx: DenisTurnContext;
  language: string;
  guestMessage?: string;
}) {
  return resolveRecoveryActionsForTurn({
    ctx: input.ctx,
    language: input.language,
    guestMessage: input.guestMessage ?? "",
  }).actions;
}

export function voiceDisabledResponse(): Response {
  return apiError("Voice is not enabled for this location.", 403);
}

export async function prepareTurnContext(input: {
  admin: SupabaseClient;
  parsed: DenisChatBody;
  channel: "chat" | "voice";
  traceId: string;
  turnStarted: number;
}): Promise<PrepareTurnContextResult> {
  const ctxStarted = performance.now();
  const [ctxBuilt, healthMetrics] = await Promise.all([
    buildDenisTurnContext(input.admin, input.parsed),
    loadDenisHealthMetrics({
      locationId: input.parsed.locationId,
    }),
  ]);
  let ctx = ctxBuilt;

  const chatAiSessionId = resolveCanonicalChatAiSessionId(
    ctx.config.party.mode,
    ctx.draftAiSessionId,
    input.parsed.sessionId
  );
  const timelineAiSessionIdForHealth =
    chatAiSessionId ?? ctx.draftAiSessionId ?? input.parsed.sessionId ?? input.traceId;

  const healthEvaluation = evaluateDenisHealth(healthMetrics);
  const healthStateTransition = await applyHealthStateTransition(
    input.parsed.locationId,
    healthEvaluation
  );
  const healthPatch = buildHealthOpsPatch(healthEvaluation);

  const degradationTransition = await applyDegradationTransition({
    locationId: input.parsed.locationId,
    health: healthMetricsToDegradationInput(healthMetrics),
    config: ctx.config,
  });
  const degradationLevel = degradationTransition.resolution.level;
  const degradationPatch = degradationOpsPatch(degradationLevel);

  const forceT0Only =
    shouldForceT0Only(healthEvaluation) ||
    degradationForcesT0Only(degradationLevel);
  const reduceProactive =
    healthStateTransition.reduceProactive ||
    shouldReduceProactiveFrequency(healthEvaluation) ||
    degradationReducesProactive(degradationLevel);
  const denisOffline = degradationDenisOffline(degradationLevel);

  ctx = {
    ...ctx,
    opsEffects: {
      skipUpsell:
        (ctx.opsEffects?.skipUpsell ?? false) ||
        healthPatch.skipUpsell ||
        degradationPatch.skipUpsell,
      shortenReplies:
        (ctx.opsEffects?.shortenReplies ?? false) ||
        healthPatch.shortenReplies ||
        degradationPatch.shortenReplies,
      empathyNote: ctx.opsEffects?.empathyNote ?? null,
      guestSafeStaffHint:
        degradationPatch.guestSafeStaffHint ??
        healthPatch.guestSafeStaffHint ??
        ctx.opsEffects?.guestSafeStaffHint ??
        null,
    },
    healthOverrides: {
      forceT0Only,
      reduceProactive,
      degradationLevel,
      denisOffline,
    },
  };

  if (degradationTransition.levelChanged) {
    logger.warn("denis.degradation.level_changed", {
      locationId: input.parsed.locationId,
      level: degradationLevel,
      previousLevel: degradationTransition.previousLevel,
      reason: degradationTransition.resolution.reason,
      disabledFeatures: degradationTransition.resolution.disabledFeatures,
    });
  }

  if (denisOffline) {
    const totalMs = elapsedMs(input.turnStarted);
    void recordHealthTurnSample(input.parsed.locationId, {
      sessionId: timelineAiSessionIdForHealth,
      latencyMs: totalMs,
      llmUsed: false,
      llmError: false,
      refusal: false,
      credits: 0,
    });

    const offlineMessage = degradationGuestOfflineMessage(input.parsed.language);
    const offlineMeta: DenisTurnMeta = {
      traceId: input.traceId,
      channel: input.channel,
      flowNodeId: ctx.flowNodeId,
      topGoal: null,
      conflictPrompt: null,
      healthStatus: healthEvaluation.status,
      operatingMode: ctx.venueOps?.operatingMode,
      kdsStress: ctx.venueOps?.kdsStress,
      sharedAiSessionId: chatAiSessionId ?? null,
    };

    if (input.channel === "voice") {
      return {
        ok: false,
        response: formatVoiceTurnApiResponse(
          {
            message: offlineMessage,
            intent: "chat",
            sessionId: chatAiSessionId ?? undefined,
          },
          offlineMeta,
          { speakText: offlineMessage, ttsRecommended: false }
        ),
      };
    }

    return {
      ok: false,
      response: formatChatTurnApiResponse(
        {
          message: offlineMessage,
          intent: "chat",
          sessionId: chatAiSessionId ?? undefined,
          quickReplies: [],
        },
        offlineMeta
      ),
    };
  }

  if (degradationLevel === "fallback") {
    const fallbackTurn = resolveDegradationFallbackTurn({
      guestMessage: input.parsed.message,
      language: input.parsed.language,
      level: degradationLevel,
    });

    if (fallbackTurn && !fallbackTurn.allowTurnPipeline) {
      const totalMs = elapsedMs(input.turnStarted);
      void recordHealthTurnSample(input.parsed.locationId, {
        sessionId: timelineAiSessionIdForHealth,
        latencyMs: totalMs,
        llmUsed: false,
        llmError: false,
        refusal: false,
        credits: 0,
      });

      const fallbackMeta: DenisTurnMeta = {
        traceId: input.traceId,
        channel: input.channel,
        flowNodeId: ctx.flowNodeId,
        topGoal: null,
        conflictPrompt: null,
        healthStatus: healthEvaluation.status,
        operatingMode: ctx.venueOps?.operatingMode,
        kdsStress: ctx.venueOps?.kdsStress,
        sharedAiSessionId: chatAiSessionId ?? null,
      };

      return {
        ok: false,
        response: formatChatTurnApiResponse(
          {
            message: fallbackTurn.message,
            intent: fallbackTurn.intent,
            sessionId: chatAiSessionId ?? undefined,
            quickReplies: fallbackTurn.quickReplies,
          },
          fallbackMeta
        ),
      };
    }
  }

  void markSessionTurnPending(
    input.parsed.locationId,
    timelineAiSessionIdForHealth
  );

  if (
    healthStateTransition.statusChanged &&
    healthEvaluation.status !== "healthy" &&
    shouldEmitHealthAlert(null, healthEvaluation)
  ) {
    logger.warn("denis.health.status_changed", {
      locationId: input.parsed.locationId,
      status: healthEvaluation.status,
      previousStatus: healthStateTransition.previousStatus,
      issues: healthEvaluation.issues,
      autoActions: healthEvaluation.autoActions.map((action) => action.type),
    });
  }

  const earlyTimelineAiSessionId = chatAiSessionId ?? ctx.draftAiSessionId ?? null;
  if (earlyTimelineAiSessionId && ctx.tableSessionState) {
    const earlyBackfill = await maybeBackfillPlacementCart({
      admin: input.admin,
      timelineAiSessionId: earlyTimelineAiSessionId,
      locationId: input.parsed.locationId,
      userMessage: input.parsed.message,
      cartDraft: ctx.aiCartState.draft,
      timeline: ctx.tableSessionState.timeline,
    });
    const cartChanged = earlyBackfill.cartDraft !== ctx.aiCartState.draft;
    if (cartChanged) {
      ctx = {
        ...ctx,
        aiCartState: {
          ...ctx.aiCartState,
          draft: earlyBackfill.cartDraft,
        },
        tableSessionState: {
          ...ctx.tableSessionState,
          commerce: {
            ...ctx.tableSessionState.commerce,
            cart: {
              ...ctx.tableSessionState.commerce.cart,
              ai: {
                ...ctx.tableSessionState.commerce.cart.ai,
                draft: earlyBackfill.cartDraft,
              },
            },
          },
        },
      };
    }

    if (ctx.tableSessionState && earlyBackfill.cartDraft.items.length > 0) {
      const quickObligation = mergeTableSessionObligation({
        state: ctx.tableSessionState,
        source: "turn",
        guestMessage: input.parsed.message,
        cartLines: earlyBackfill.cartDraft.items,
        language: input.parsed.language,
      });
      if (quickObligation.canConfirm) {
        const tableSessionState = ctx.tableSessionState;
        ctx = {
          ...ctx,
          flowNodeId: "recap",
          tableSessionState: {
            ...tableSessionState,
            conversation: {
              ...tableSessionState.conversation,
              flowNodeId: "recap",
              model: {
                ...tableSessionState.conversation.model,
                awaiting: "confirm",
              },
            },
          },
        };
      }
    }
  }

  return {
    ok: true,
    prepared: {
      ctx,
      chatAiSessionId: chatAiSessionId ?? null,
      timelineAiSessionIdForHealth,
      healthEvaluation,
      healthStateTransition,
      degradationTransition,
      contextMs: elapsedMs(ctxStarted),
    },
  };
}
