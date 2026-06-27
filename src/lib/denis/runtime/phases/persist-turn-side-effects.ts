import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { isDenisRefusalReply } from "@/lib/ai/conversation-leadership";
import {
  buildAllergyAuditDetail,
  buildAuditEntry,
  scheduleDenisAuditEntry,
} from "@/lib/denis/compliance";
import {
  finalizeTurnMetering,
  maybeEnqueueLowBalanceAlert,
  refreshOrgAiOpsProjection,
} from "@/lib/denis/commercial";
import {
  kernelTimelineEnabled,
} from "@/lib/denis/config/rollout";
import { deriveGuestMemoryToken } from "@/lib/guest/denis-guest-memory-token";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type {
  PerceptionChannel,
  TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
import {
  guestFollowUpFromMessage,
  persistGuestFollowUpRequest,
} from "@/lib/denis/runtime/persist-guest-continuity";
import { persistDenisTurnTimeline } from "@/lib/denis/runtime/persist-turn-timeline";
import {
  guestIntentTierFromReflex,
  resolveTurnIntent,
} from "@/lib/denis/runtime/map-legacy-intent";
import {
  elapsedMs,
  logDenisTurnObservability,
} from "@/lib/denis/runtime/turn-observability";
import {
  buildTurnTrace,
  scheduleTurnTraceWrite,
} from "@/lib/denis/runtime/turn-trace";
import type {
  ActOnTurnResult,
  NarrateTurnResult,
  PerceiveTurnResult,
  PreparedTurnContext,
} from "@/lib/denis/runtime/phases/phase-types";
import type { TurnPhaseTimings } from "@/lib/denis/runtime/turn-observability";
import type { DenisChatBody } from "@/lib/denis/runtime/turn-types";
import { recordHealthTurnSample } from "@/lib/denis/monitoring";
import { upsertDenisTurnDailyRollup } from "@/lib/commerce/projections/rollup-denis-roi-daily";
import { scheduleStaffNotification } from "@/lib/denis/notifications/dispatch-staff-notification";
import { DEFAULT_NOTIFICATION_RULES } from "@/lib/denis/notifications/staff-notifications";
import { resolveRuntimeProfile } from "@/lib/denis/cognition/resolve-runtime-profile";
import {
  resolveActiveTableSessionId,
  resolveGuestTableSessionLookupToken,
} from "@/lib/denis/venue/party";
import { scheduleGuestSceneRefresh } from "@/lib/scene/enqueue-scene-refresh";
import { mapTurnToSceneOverrides } from "@/lib/scene/map-turn-to-scene-overrides";
import type { AiRecommendation } from "@/lib/ai/types";
import {
  appendMindTurnProfile,
  buildTurnProfile,
} from "@/lib/denis/cognition/quality/turn-profile";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistTurnSideEffects(input: {
  admin: SupabaseClient;
  parsed: DenisChatBody;
  prepared: PreparedTurnContext;
  perceive: PerceiveTurnResult;
  act: ActOnTurnResult;
  narrated: NarrateTurnResult;
  orgId: string;
  traceId: string;
  channel: "chat" | "voice";
  turnStarted: number;
  timings: TurnPhaseTimings;
  creditBalanceAfter: number;
}): Promise<{ creditsRemaining: number; creditsCharged: number }> {
  const { ctx } = input.act;
  const { perceiveResult, reflexTurn, slotExtract, rolloutMode } =
    input.perceive;
  const perceiveData = input.act.perceiveData;
  const timelineAiSessionId = input.perceive.timelineAiSessionId;
  const timelineAiSessionIdForHealth = input.prepared.timelineAiSessionIdForHealth;

  const timelineSurface: TurnEnvelope["surface"] =
    input.channel === "voice" ? "voice" : "chat";
  const perceptionChannel: PerceptionChannel =
    input.channel === "voice" ? "voice.transcript" : "chat.message";

  const deferTimelineForReflexSubmit =
    Boolean(input.act.turnSubmitOutcome.orderId) &&
    !perceiveResult.llmUsed &&
    perceiveResult.turnPlan.reason === "commerce.confirm.reflex_submit";

  if (
    input.perceive.timelineEnabled &&
    input.perceive.aiSessionId &&
    input.perceive.beliefGraph
  ) {
    void appendMindTurnProfile(input.admin, {
      aiSessionId: input.perceive.aiSessionId,
      traceId: input.traceId,
      truthHash: ctx.foldMeta?.truthHash,
      profile: buildTurnProfile({
        turnPlan: perceiveResult.turnPlan,
        llmUsed: perceiveResult.llmUsed,
        tier: perceiveResult.tier,
        beliefs: input.perceive.beliefGraph,
        evidencePointers: perceiveResult.evidencePointers,
        pendingSlotActResolved: perceiveResult.pendingSlotActResolved,
      }),
    }).catch((error) => {
      logger.warn("Denis turn profile write failed", {
        traceId: input.traceId,
        aiSessionId: input.perceive.aiSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  const creditsCharged = perceiveData.creditsCharged ?? 0;

  const runMetering = async (): Promise<number | undefined> => {
    if (!timelineAiSessionId || creditsCharged <= 0) {
      return undefined;
    }

    const meteringStarted = performance.now();
    const metering = await finalizeTurnMetering(input.admin, {
      orgId: input.orgId,
      aiSessionId: timelineAiSessionId,
      traceId: input.traceId,
    });

    if (metering.ok) {
      await maybeEnqueueLowBalanceAlert(input.admin, {
        orgId: input.orgId,
        locationId: input.parsed.locationId,
        balanceAfter: metering.balanceAfter,
        traceId: input.traceId,
      });
      void refreshOrgAiOpsProjection(input.admin, input.orgId).catch(
        (error) => {
          logger.warn("Denis turn org_ai_ops refresh failed", {
            orgId: input.orgId,
            traceId: input.traceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      );
      input.timings.meteringMs = elapsedMs(meteringStarted);
      return metering.balanceAfter;
    }

    logger.error("Denis turn metering finalize failed", {
      traceId: input.traceId,
      aiSessionId: timelineAiSessionId,
      orgId: input.orgId,
      code: metering.code,
    });
    input.timings.meteringMs = elapsedMs(meteringStarted);
    return undefined;
  };

  let meteredBalance: number | undefined;
  const postResponseTasks: Promise<unknown>[] = [
    runMetering().then((balance) => {
      meteredBalance = balance;
    }),
  ];

  if (timelineAiSessionId && kernelTimelineEnabled(rolloutMode)) {
    const timelineStarted = performance.now();
    const intent = resolveTurnIntent(
      reflexTurn.reflex?.intent,
      perceiveData.intent ?? "UNKNOWN"
    );

    const writeTurnTimeline = async () => {
      await persistDenisTurnTimeline(input.admin, {
        aiSessionId: timelineAiSessionId,
        locationId: input.parsed.locationId,
        traceId: input.traceId,
        guestMessage: input.parsed.message,
        assistantMessage: input.narrated.guestMessage,
        intent,
        intentTier: guestIntentTierFromReflex(reflexTurn.usedT0),
        narrationTier: input.narrated.narration.tier,
        reflexTurn,
        channel: perceptionChannel,
        timelineSurface,
      });

      const followUp = guestFollowUpFromMessage(input.parsed.message);
      if (followUp) {
        await persistGuestFollowUpRequest(input.admin, {
          aiSessionId: timelineAiSessionId,
          traceId: input.traceId,
          guestMessage: input.parsed.message,
          delaySeconds: followUp.delaySeconds,
        });
      }

      if (slotExtract && slotExtract.items.length > 0) {
        await appendDenisTimelineEvent(input.admin, {
          aiSessionId: timelineAiSessionId,
          eventType: "slot.extracted",
          traceId: input.traceId,
          payload: {
            type: "slot.extracted",
            tier: slotExtract.tier,
            itemCount: slotExtract.items.length,
            items: slotExtract.items,
            unmappedSpans: slotExtract.unmappedSpans,
          },
        });
      }

      for (const skillResult of input.act.actPhase.results) {
        await appendDenisTimelineEvent(input.admin, {
          aiSessionId: timelineAiSessionId,
          eventType: "skill.executed",
          traceId: input.traceId,
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

      if (
        input.act.allergyCtx.allergyAcknowledged &&
        input.act.allergyCtx.guard.conflicts.length > 0 &&
        input.act.turnSubmitOutcome.orderId
      ) {
        await appendDenisTimelineEvent(input.admin, {
          aiSessionId: timelineAiSessionId,
          eventType: "safety.allergy_acknowledged",
          traceId: input.traceId,
          payload: {
            type: "safety.allergy_acknowledged",
            conflicts: input.act.allergyCtx.guard.conflicts,
            orderId: input.act.turnSubmitOutcome.orderId,
          },
        });
      }
    };

    if (deferTimelineForReflexSubmit) {
      void writeTurnTimeline().catch((error) => {
        logger.warn("Denis reflex submit timeline write failed", {
          traceId: input.traceId,
          aiSessionId: timelineAiSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      postResponseTasks.push(
        writeTurnTimeline().finally(() => {
          input.timings.timelineMs = elapsedMs(timelineStarted);
        })
      );
    }
  }

  await Promise.all(postResponseTasks);

  let creditsRemaining =
    perceiveData.creditsRemaining ?? input.creditBalanceAfter;
  if (meteredBalance != null) {
    creditsRemaining = meteredBalance;
  }

  input.timings.contextMs = input.prepared.contextMs;
  input.timings.legacyMs = input.perceive.legacyMs;
  input.timings.actMs = input.act.actMs;
  input.timings.narrateMs = input.narrated.narrateMs;

  const { profile } = resolveRuntimeProfile(ctx.config);

  logDenisTurnObservability({
    traceId: input.traceId,
    locationId: input.parsed.locationId,
    channel: input.channel,
    rolloutMode,
    guestUsesLegacy: input.narrated.guestUsesLegacy,
    narrationTier: input.narrated.narration.tier,
    lintPassed: input.narrated.narration.lintPassed,
    creditsCharged,
    actDryRun: input.act.actPhase.dryRun,
    actEnabled: input.act.actPhase.enabled,
    actSubmitLive: input.act.actSubmitLive,
    actSubmitAttempted: input.act.turnSubmitOutcome.attempted,
    actOrderNumber: input.act.turnSubmitOutcome.orderNumber,
    shadowParityScore: input.narrated.shadowParityScore,
    llmUsed: perceiveResult.llmUsed,
    planKind: perceiveResult.planKind,
    tier: perceiveResult.tier,
    evidencePointers: perceiveResult.evidencePointers,
    timings: input.timings,
  });

  if (timelineAiSessionId) {
    scheduleTurnTraceWrite(
      input.admin,
      buildTurnTrace({
        traceId: input.traceId,
        aiSessionId: timelineAiSessionId,
        locationId: input.parsed.locationId,
        guestInput: input.parsed.message,
        language: input.parsed.language,
        orgId: input.orgId,
        creditsRemaining: input.creditBalanceAfter,
        contextMs: input.timings.contextMs,
        legacyMs: input.timings.legacyMs,
        actMs: input.timings.actMs,
        narrateMs: input.timings.narrateMs,
        totalMs: input.timings.totalMs,
        tier: perceiveResult.tier,
        planKind: perceiveResult.planKind,
        reflexReason: perceiveResult.turnPlan.reason,
        llmUsed: perceiveResult.llmUsed,
        model: perceiveResult.llmUsed ? `${profile.tier}:llm` : undefined,
        cartActionCount: perceiveData.cartActions?.length ?? 0,
        submitTriggered: Boolean(input.act.turnSubmitOutcome.orderId),
        obligationFired: input.act.waiterObligation.gaps.length > 0,
        denisResponse: input.narrated.guestMessage,
        quickReplies: input.narrated.quickReplies,
        orderCount: ctx.tableSessionState?.commerce.orders.length,
      })
    );
  }

  void recordHealthTurnSample(input.parsed.locationId, {
    sessionId: timelineAiSessionId ?? timelineAiSessionIdForHealth,
    latencyMs: input.timings.totalMs,
    llmUsed: perceiveResult.llmUsed,
    llmError:
      !ctx.healthOverrides?.forceT0Only &&
      perceiveResult.turnPlan.requiresLlm &&
      !perceiveResult.llmUsed,
    refusal: isDenisRefusalReply(input.narrated.guestMessage),
    credits: creditsCharged,
  });

  void upsertDenisTurnDailyRollup(input.admin, {
    orgId: input.orgId,
    locationId: input.parsed.locationId,
    createdAt: new Date().toISOString(),
    llmUsed: perceiveResult.llmUsed,
    creditsCharged,
  }).catch((error) => {
    logger.warn("Denis ROI turn rollup failed", {
      locationId: input.parsed.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  scheduleDenisAuditEntry(input.admin, {
    orgId: input.orgId,
    locationId: input.parsed.locationId,
    tableSessionId: ctx.foldMeta?.tableSessionId ?? null,
    guestTokenHash:
      input.parsed.deviceFingerprint?.trim()
        ? deriveGuestMemoryToken(
            input.parsed.locationId,
            input.parsed.deviceFingerprint
          )
        : null,
    entry: buildAuditEntry({
      traceId: input.traceId,
      sessionId: timelineAiSessionId,
      guestMessage: input.parsed.message,
      denisResponse: input.narrated.guestMessage,
      turnPlan: perceiveResult.turnPlan,
      tier: perceiveResult.tier,
      llmUsed: perceiveResult.llmUsed,
      model: perceiveResult.llmUsed
        ? `${profile.tier}:llm`
        : `${profile.tier}:reflex`,
      latencyMs: Math.round(input.timings.totalMs),
      evidencePointers: perceiveResult.evidencePointers,
      actResults: input.act.actPhase.results,
      actSubmitLive: input.act.actSubmitLive,
      allergyGuard: input.act.allergyCtx.guard,
      allergyAcknowledged: input.act.allergyCtx.allergyAcknowledged,
      orderSubmitted: Boolean(input.act.turnSubmitOutcome.orderId),
      orderId: input.act.turnSubmitOutcome.orderId ?? null,
      creditsCost: creditsCharged,
      guestMemoryUsed: Boolean(ctx.guestMemory),
      knownAllergieLabels: input.act.allergyCtx.knownAllergieLabels,
    }),
    allergyDetail: buildAllergyAuditDetail({
      guard: input.act.allergyCtx.guard,
      knownAllergieLabels: input.act.allergyCtx.knownAllergieLabels,
      allergyAcknowledged: input.act.allergyCtx.allergyAcknowledged,
      orderId: input.act.turnSubmitOutcome.orderId ?? null,
    }),
  });

  const [tableSessionId, menuCache] = await Promise.all([
    resolveActiveTableSessionId(input.admin, {
      tableId: input.parsed.tableId,
      locationId: input.parsed.locationId,
      sessionToken: resolveGuestTableSessionLookupToken(input.parsed),
    }),
    getCachedMenuForLocation(input.parsed.locationId).catch(() => null),
  ]);

  if (tableSessionId) {
    const productNames: Record<string, string> = {};
    if (menuCache?.productMap) {
      for (const [id, product] of Object.entries(menuCache.productMap)) {
        productNames[id] = product.name;
      }
    }

    const sceneOverrides = mapTurnToSceneOverrides({
      tableSessionId,
      quickReplies: input.narrated.quickReplies,
      recommendations: (perceiveData.recommendations ?? []) as AiRecommendation[],
      productNames,
      markState: "idle",
      sheetOpen: false,
      thinking: false,
    });

    if (
      input.act.turnSubmitOutcome.attempted &&
      input.act.turnSubmitOutcome.orderId &&
      input.act.turnSubmitOutcome.orderNumber != null
    ) {
      sceneOverrides.proactiveBanner = {
        id: `order-placed-${input.act.turnSubmitOutcome.orderId}`,
        message: `#${input.act.turnSubmitOutcome.orderNumber}`,
        action: "view_order",
        orderId: input.act.turnSubmitOutcome.orderId,
      };
    }

    void scheduleGuestSceneRefresh(input.admin, sceneOverrides).catch((error) => {
      logger.warn("Denis turn scene refresh failed", {
        traceId: input.traceId,
        tableSessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  const tableName =
    ctx.tableSessionState?.table?.name?.trim() || undefined;
  const tableId = input.parsed.tableId;
  const locationId = input.parsed.locationId;

  if (
    !input.act.allergyCtx.guard.safe &&
    input.act.allergyCtx.guard.conflicts.length > 0
  ) {
    const allergenList = input.act.allergyCtx.guard.conflicts
      .slice(0, 3)
      .map((row) => row.allergen)
      .join(", ");
    scheduleStaffNotification({
      orgId: input.orgId,
      locationId,
      tableId,
      tableName,
      type: "allergy_alert",
      message:
        input.act.allergyCtx.guard.message ??
        `Allergen conflict: ${allergenList}`,
    });
  }

  const orderId = input.act.turnSubmitOutcome.orderId;
  if (orderId) {
    void Promise.resolve(
      input.admin
        .from("orders")
        .select("total")
        .eq("id", orderId)
        .maybeSingle()
    )
      .then(({ data }) => {
        const total = Number((data as { total?: number } | null)?.total ?? 0);
        if (
          Number.isFinite(total) &&
          total >= DEFAULT_NOTIFICATION_RULES.highValueThreshold
        ) {
          scheduleStaffNotification({
            orgId: input.orgId,
            locationId,
            tableId,
            tableName,
            type: "high_value_order",
            message: `High value order €${total.toFixed(2)}`,
          });
        }
      })
      .catch(() => undefined);
  }

  if (perceiveData.intent === "HANDOFF_WAITER") {
    scheduleStaffNotification({
      orgId: input.orgId,
      locationId,
      tableId,
      tableName,
      type: "denis_escalation",
      message: "Guest requested waiter handoff via Denis",
    });
  }

  return { creditsRemaining, creditsCharged };
}
