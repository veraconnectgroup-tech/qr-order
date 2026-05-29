import { apiError } from "@/lib/api-response";
import { perceiveGuestChatTurn } from "@/lib/denis/runtime/perceive/perceive-guest-chat-turn";
import { applyStructuredPerceptionOrdering } from "@/lib/denis/runtime/perceive/apply-structured-perception-ordering";
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
import { appendMindFoldCompleted } from "@/lib/denis/loop/append-fold-completed";
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
import { executeActPhase, isActSubmitLive, resolveActSubmitOutcome } from "@/lib/denis/runtime/act";
import { executeTurnOrderSubmit } from "@/lib/denis/runtime/act/execute-turn-order-submit";
import { persistAiSessionAfterOrderSubmit } from "@/lib/denis/runtime/act/persist-ai-session-after-order-submit";
import {
  handoffActEnabled,
  resolveActHandoffOutcome,
} from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import {
  elapsedMs,
  emptyTurnTimings,
  logDenisTurnObservability,
} from "@/lib/denis/runtime/turn-observability";
import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import type { AiStructuredResponse } from "@/lib/ai/types";
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
import { resolveActiveTableSessionId } from "@/lib/denis/venue/party";
import { scheduleGuestSceneRefresh } from "@/lib/scene/enqueue-scene-refresh";
import { mapTurnToSceneOverrides } from "@/lib/scene/map-turn-to-scene-overrides";
import type { AiRecommendation } from "@/lib/ai/types";

function dedupeHandoffQuickReplies(
  primary: string[],
  handoff?: string[]
): string[] {
  if (!handoff?.length) return primary;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chip of [...handoff, ...primary]) {
    const trimmed = chip.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, 6);
}

function isSupportedTurnChannel(
  channel: DenisTurnRunInput["channel"]
): channel is "chat" | "voice" {
  return channel === "chat" || channel === "voice";
}

type PerceiveChatPayload = {
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
    structuredPerception?: AiStructuredResponse;
  };
};

/**
 * Denis PPAN+ entry — perceive → plan → act → tell → timeline (G4 single loop).
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

  if (
    ctx.draftAiSessionId &&
    ctx.foldMeta &&
    kernelTimelineEnabled(resolveEffectiveRollout(ctx.config).mode)
  ) {
    await appendMindFoldCompleted(admin, {
      aiSessionId: ctx.draftAiSessionId,
      traceId,
      meta: ctx.foldMeta,
    });
  }

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
    structuredIntent: parsed.data.structuredIntent,
    handoffPaymentMethod: parsed.data.handoffPaymentMethod,
  });

  const slotExtract = shouldRunSlotExtract(ctx.config, reflexTurn)
    ? await extractOrderSlots({
        utterance: parsed.data.message,
        language: parsed.data.language,
        config: ctx.config,
      })
    : null;

  const rollout = resolveEffectiveRollout(ctx.config);
  const timelineEnabled = kernelTimelineEnabled(rollout.mode);

  const perceiveStarted = performance.now();
  const perceiveResponse = await perceiveGuestChatTurn(parsed.data, {
    persistMessages: !timelineEnabled,
  });
  timings.legacyMs = elapsedMs(perceiveStarted);
  if (perceiveResponse.status !== 200) {
    return perceiveResponse;
  }

  const payload = (await perceiveResponse.json()) as PerceiveChatPayload;
  const data = payload.data;

  if (!data?.message) {
    return perceiveResponse;
  }

  let cartDraftForAct = ctx.aiCartState.draft;
  const actSubmitLive = isActSubmitLive(ctx.config);

  if (data.structuredPerception && data.sessionId) {
    const ordered = await applyStructuredPerceptionOrdering({
      admin,
      sessionId: data.sessionId,
      locationId: parsed.data.locationId,
      userMessage: parsed.data.message,
      language: parsed.data.language,
      structured: data.structuredPerception,
      timelineEnabled,
      fallbackDraft: cartDraftForAct,
      traceId,
    });

    if (ordered) {
      cartDraftForAct = ordered.cartDraft;
      data.message = ordered.message || data.message;
      data.cartActions = ordered.cartActions;
      data.quickReplies = ordered.quickReplies;
      data.intent = ordered.intent;
      data.submitOrder = ordered.submitOrder;
    }
  }

  let actPhase: Awaited<ReturnType<typeof executeActPhase>> = {
    enabled: false,
    dryRun: true,
    results: [],
  };
  const shouldRunAct =
    ctx.config.ordering.actLayerEnabled ||
    (handoffActEnabled(ctx.config) && reflexTurn.handoffCommand !== null);

  if (shouldRunAct) {
    let catalog;
    const legacyWantsSubmit = Boolean(data.submitOrder);
    const needsCatalog = actSubmitLive && legacyWantsSubmit;
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
      tableId: parsed.data.tableId,
      locationId: parsed.data.locationId,
      tableToken: parsed.data.sessionToken,
      sessionToken: parsed.data.tableSessionToken,
      deviceFingerprint: parsed.data.deviceFingerprint ?? undefined,
      deviceToken: parsed.data.deviceToken ?? undefined,
      cartDraft: cartDraftForAct,
      catalog,
      legacySubmitOrder: legacyWantsSubmit,
    });
    timings.actMs = elapsedMs(actStarted);
  }

  const actSubmitOutcome = resolveActSubmitOutcome(actPhase);

  let turnSubmitOutcome = actSubmitOutcome;
  if (Boolean(data.submitOrder) && !turnSubmitOutcome.attempted && data.sessionId) {
    const unifiedStarted = performance.now();
    turnSubmitOutcome = await executeTurnOrderSubmit(admin, {
      aiSessionId: data.sessionId,
      locationId: parsed.data.locationId,
      tableToken: parsed.data.sessionToken,
      sessionToken: parsed.data.tableSessionToken,
      deviceFingerprint: parsed.data.deviceFingerprint,
      deviceToken: parsed.data.deviceToken,
      cartDraft: cartDraftForAct,
    });
    timings.actMs = (timings.actMs ?? 0) + elapsedMs(unifiedStarted);
  }

  if (
    actSubmitOutcome.attempted &&
    actSubmitOutcome.orderId &&
    data.sessionId &&
    turnSubmitOutcome.orderId === actSubmitOutcome.orderId
  ) {
    await persistAiSessionAfterOrderSubmit(admin, {
      aiSessionId: data.sessionId,
      orderId: actSubmitOutcome.orderId,
      orderNumber: actSubmitOutcome.orderNumber,
      awaitingApproval: actSubmitOutcome.awaitingApproval,
      source: "denis_act_acl",
    });
  }

  const actHandoffOutcome = resolveActHandoffOutcome(
    actPhase,
    parsed.data.language
  );

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
    orderNumber: turnSubmitOutcome.orderNumber ?? null,
    blockedReason: turnSubmitOutcome.guestBlockedReason ?? null,
    handoffMessage: actHandoffOutcome.guestMessage ?? null,
    venueOps: ctx.venueOps,
    opsEffects: ctx.opsEffects,
  });

  const narrateStarted = performance.now();
  const resolvedNarration = await resolveTurnNarrationMessage({
    legacyMessage: data.message,
    facts: narrationFacts,
    config: ctx.config,
    rolloutMode: rollout.mode,
    guestUsesLegacy,
  });
  const narration = resolvedNarration.usedDenisNarrator
    ? sanitizeNarrationOutput(resolvedNarration.draftMessage, narrationFacts)
    : {
        message: resolvedNarration.draftMessage.trim(),
        tier: "legacy" as const,
        lintPassed: true,
        issues: [],
        usedFallback: false,
      };
  const quickReplies = dedupeHandoffQuickReplies(
    resolveTurnQuickReplies({
      reflexTurn,
      facts: narrationFacts,
      narration,
      legacyQuickReplies: data.quickReplies,
      language: parsed.data.language,
    }),
    actHandoffOutcome.quickReplies
  );
  let guestMessage =
    actHandoffOutcome.overrideLegacy && actHandoffOutcome.guestMessage
      ? actHandoffOutcome.guestMessage
      : !resolvedNarration.usedDenisNarrator
        ? data.message
        : narration.message;

  if (turnSubmitOutcome.guestBlockedReason && !turnSubmitOutcome.orderId) {
    guestMessage = turnSubmitOutcome.guestBlockedReason;
  }
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
    actSubmitLive,
    actSubmitAttempted: turnSubmitOutcome.attempted,
    actOrderNumber: turnSubmitOutcome.orderNumber,
    shadowParityScore,
    timings,
  });

  const responseData = {
    message: guestMessage,
    recommendations: data.recommendations,
    cartActions: data.cartActions,
    quickReplies,
    intent: data.intent,
    submitOrder: false,
    creditsRemaining,
    sessionId: data.sessionId,
    ...(turnSubmitOutcome.attempted && turnSubmitOutcome.orderId
      ? {
          orderSubmit: {
            orderId: turnSubmitOutcome.orderId,
            orderNumber: turnSubmitOutcome.orderNumber,
            awaitingApproval: turnSubmitOutcome.awaitingApproval ?? false,
            sessionOpened: turnSubmitOutcome.sessionOpened,
          },
        }
      : {}),
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
    actSubmitLive,
    actSubmitAttempted: turnSubmitOutcome.attempted,
    actOrderNumber: turnSubmitOutcome.orderNumber,
  };

  const tableSessionId = await resolveActiveTableSessionId(admin, {
    tableId: parsed.data.tableId,
    locationId: parsed.data.locationId,
    sessionToken: parsed.data.sessionToken,
  });

  if (tableSessionId) {
    const menuCache = await getCachedMenuForLocation(parsed.data.locationId);
    const productNames: Record<string, string> = {};
    if (menuCache?.productMap) {
      for (const [id, product] of Object.entries(menuCache.productMap)) {
        productNames[id] = product.name;
      }
    }

    const sceneOverrides = mapTurnToSceneOverrides({
      tableSessionId,
      quickReplies,
      recommendations: (data.recommendations ?? []) as AiRecommendation[],
      productNames,
      markState: "idle",
      sheetOpen: false,
      thinking: false,
    });

    if (
      turnSubmitOutcome.attempted &&
      turnSubmitOutcome.orderId &&
      turnSubmitOutcome.orderNumber != null
    ) {
      sceneOverrides.proactiveBanner = {
        id: `order-placed-${turnSubmitOutcome.orderId}`,
        message: `#${turnSubmitOutcome.orderNumber}`,
        action: "view_order",
        orderId: turnSubmitOutcome.orderId,
      };
    }

    void scheduleGuestSceneRefresh(admin, sceneOverrides).catch((error) => {
      logger.warn("Denis turn scene refresh failed", {
        traceId,
        tableSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  if (input.channel === "voice") {
    return formatVoiceTurnApiResponse(responseData, responseMeta, {
      speakText: guestMessage,
      ttsRecommended: ctx.config.surfaces.voiceTtsEnabled,
    });
  }

  return formatChatTurnApiResponse(responseData, responseMeta);
}
