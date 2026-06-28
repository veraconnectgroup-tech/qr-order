import { getCachedMenuForLocation } from "@/lib/ai/menu-cache";
import { applyStructuredPerceptionOrdering } from "@/lib/denis/runtime/perceive/apply-structured-perception-ordering";
import { resolveTurnAllergyContext } from "@/lib/denis/cognition/safety/resolve-turn-allergy-context";
import {
  assessWaiterObligation,
  mergeTableSessionObligation,
  lastOrderPlacementFromTranscript,
} from "@/lib/denis/cognition/waiter";
import { syncGuestMemoryProfile } from "@/lib/guest/denis-guest-memory-store";
import {
  executeActPhase,
  isActSubmitLive,
  resolveActSubmitOutcome,
} from "@/lib/denis/runtime/act";
import { executeTurnOrderSubmit } from "@/lib/denis/runtime/act/execute-turn-order-submit";
import { persistAiSessionAfterOrderSubmit } from "@/lib/denis/runtime/act/persist-ai-session-after-order-submit";
import {
  handoffActEnabled,
  resolveActHandoffOutcome,
} from "@/lib/denis/runtime/act/resolve-act-handoff-outcome";
import { resolveActOrderChangeOutcome } from "@/lib/denis/runtime/act/resolve-act-order-change-outcome";
import {
  tryResolvePendingSlotAct,
  sessionDraftHasPendingSlot,
} from "@/lib/denis/runtime/act/resolve-pending-slot-act";
import type { ActPhaseResult } from "@/lib/denis/runtime/act/act-types";
import { maybeBackfillPlacementCart } from "@/lib/denis/runtime/phases/turn-cart-helpers";
import { runHandoffAclFallback } from "@/lib/denis/runtime/phases/run-handoff-acl-fallback";
import type {
  ActOnTurnResult,
  PerceiveTurnResult,
} from "@/lib/denis/runtime/phases/phase-types";
import type { DenisChatBody } from "@/lib/denis/runtime/turn-types";
import type { PendingSlotKind } from "@/lib/denis/platform/pending-slot-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConciergeIntent, AiStructuredResponse } from "@/lib/ai/types";

function normalizeIntent(value: unknown): AiConciergeIntent {
  return value === "status" ||
    value === "confirm" ||
    value === "order" ||
    value === "recommend" ||
    value === "clarify" ||
    value === "menu_info" ||
    value === "chat"
    ? value
    : "chat";
}

function normalizeStructuredResponse(
  value: AiStructuredResponse["structuredPerception"]
): AiStructuredResponse {
  return {
    intent: normalizeIntent(value?.intent),
    message: typeof value?.message === "string" ? value.message : "",
    recommendations: value?.recommendations ?? [],
    proposedItems: value?.proposedItems ?? [],
    cartActions: value?.cartActions ?? [],
    quickReplies: value?.quickReplies ?? [],
    submitOrder: value?.submitOrder ?? false,
    creditsRemaining: value?.creditsRemaining,
    sessionId: value?.sessionId,
    structuredPerception: value,
  };
}

export async function actOnTurn(input: {
  admin: SupabaseClient;
  parsed: DenisChatBody;
  perceive: PerceiveTurnResult;
  traceId: string;
}): Promise<ActOnTurnResult> {
  let { ctx } = input.perceive;
  const { perceiveResult, reflexTurn, pendingSlot } = input.perceive;
  let perceiveData = { ...input.perceive.perceiveData };
  const timelineAiSessionId = input.perceive.timelineAiSessionId;

  let cartDraftForAct =
    perceiveResult.cartDraftFromAct ?? ctx.aiCartState.draft;
  const actSubmitLive = isActSubmitLive(ctx.config);
  const pendingSlotActApplied = perceiveResult.pendingSlotActResolved === true;

  if (
    perceiveData.structuredPerception &&
    timelineAiSessionId &&
    !pendingSlotActApplied &&
    perceiveResult.llmUsed
  ) {
    const ordered = await applyStructuredPerceptionOrdering({
      admin: input.admin,
      sessionId: timelineAiSessionId,
      locationId: input.parsed.locationId,
      userMessage: input.parsed.message,
      language: input.parsed.language,
      structured: normalizeStructuredResponse(perceiveData.structuredPerception),
      timelineEnabled: input.perceive.timelineEnabled,
      fallbackDraft: cartDraftForAct,
      traceId: input.traceId,
    });

    if (ordered) {
      cartDraftForAct = ordered.cartDraft;
      perceiveData = {
        ...perceiveData,
        message: ordered.message || perceiveData.message,
        cartActions: ordered.cartActions,
        quickReplies: ordered.quickReplies,
        intent: normalizeIntent(ordered.intent),
        submitOrder: ordered.submitOrder,
      };
    }
  }

  if (timelineAiSessionId && !pendingSlotActApplied) {
    const backfill = await maybeBackfillPlacementCart({
      admin: input.admin,
      timelineAiSessionId,
      locationId: input.parsed.locationId,
      userMessage: input.parsed.message,
      cartDraft: cartDraftForAct,
      timeline: ctx.tableSessionState?.timeline,
    });

    cartDraftForAct = backfill.cartDraft;
    if (backfill.cartActions.length > 0) {
      perceiveData = {
        ...perceiveData,
        cartActions: [
          ...(perceiveData.cartActions ?? []),
          ...backfill.cartActions,
        ],
      };
    }
  }

  if (
    timelineAiSessionId &&
    !pendingSlotActApplied &&
    (await sessionDraftHasPendingSlot(input.admin, timelineAiSessionId))
  ) {
    const retryAct = await tryResolvePendingSlotAct({
      admin: input.admin,
      sessionId: timelineAiSessionId,
      locationId: input.parsed.locationId,
      userMessage: input.parsed.message,
      language: input.parsed.language,
      pendingSlot: pendingSlot ?? "serve_size",
    });

    if (retryAct.resolved) {
      cartDraftForAct = retryAct.cartDraft;
      perceiveData = {
        ...perceiveData,
        message: retryAct.message,
        cartActions: [
          ...(perceiveData.cartActions ?? []),
          ...retryAct.cartActions,
        ],
        quickReplies: retryAct.quickReplies,
        intent: retryAct.intent,
        structuredPerception: retryAct.structuredPerception,
        submitOrder: retryAct.structuredPerception.submitOrder ?? false,
      };
    }
  }

  const allergyCtx = await resolveTurnAllergyContext({
    locationId: input.parsed.locationId,
    cartLines: cartDraftForAct.items,
    guestMemory: ctx.guestMemory,
    guestMessage: input.parsed.message,
    language: input.parsed.language,
    priorPrimaryGap:
      ctx.tableSessionState?.conversation.obligation?.primaryGap ?? null,
  });

  if (
    ctx.guestMemory &&
    ctx.config.memory.returnGuestEnabled &&
    input.parsed.deviceFingerprint &&
    allergyCtx.knownAllergieLabels.length >
      ctx.guestMemory.allergyLabels.length
  ) {
    const synced = await syncGuestMemoryProfile(input.admin, {
      locationId: input.parsed.locationId,
      deviceFingerprint: input.parsed.deviceFingerprint,
      ttlDays: ctx.config.memory.memoryTtlDays,
      sync: { allergyLabels: allergyCtx.knownAllergieLabels },
    }).catch(() => null);
    if (synced) {
      ctx = { ...ctx, guestMemory: synced };
    } else {
      ctx = {
        ...ctx,
        guestMemory: {
          ...ctx.guestMemory,
          allergyLabels: allergyCtx.knownAllergieLabels,
        },
      };
    }
  } else if (
    allergyCtx.knownAllergieLabels.length > 0 &&
    ctx.guestMemory &&
    allergyCtx.knownAllergieLabels.length > ctx.guestMemory.allergyLabels.length
  ) {
    ctx = {
      ...ctx,
      guestMemory: {
        ...ctx.guestMemory,
        allergyLabels: allergyCtx.knownAllergieLabels,
      },
    };
  }

  const waiterObligation = ctx.tableSessionState
    ? mergeTableSessionObligation({
        state: ctx.tableSessionState,
        source: "turn",
        guestMessage: input.parsed.message,
        cartLines: cartDraftForAct.items,
        pendingSlot:
          (pendingSlot as PendingSlotKind | null) ??
          ctx.tableSessionState.conversation.pendingSlot ??
          null,
        language: input.parsed.language,
        atRecap: ctx.flowNodeId === "recap" || ctx.flowNodeId === "submit",
        allergyGuard: allergyCtx.guard,
        allergyAcknowledged: allergyCtx.allergyAcknowledged,
      })
    : assessWaiterObligation({
        guestMessage: input.parsed.message,
        orderContextMessage: lastOrderPlacementFromTranscript([]),
        cartLines: cartDraftForAct.items,
        pendingSlot: (pendingSlot as PendingSlotKind | null) ?? null,
        language: input.parsed.language,
        atRecap: ctx.flowNodeId === "recap" || ctx.flowNodeId === "submit",
        allergyGuard: allergyCtx.guard,
        allergyAcknowledged: allergyCtx.allergyAcknowledged,
      });

  if (perceiveData.submitOrder && !waiterObligation.canConfirm) {
    perceiveData = { ...perceiveData, submitOrder: false };
  }

  let actPhase: ActPhaseResult = {
    enabled: false,
    dryRun: true,
    results: [],
  };
  const shouldRunAct =
    ctx.config.ordering.actLayerEnabled ||
    (handoffActEnabled(ctx.config) && reflexTurn.handoffCommand !== null);

  let actMs = 0;
  if (shouldRunAct) {
    let catalog;
    const legacyWantsSubmit = Boolean(perceiveData.submitOrder);
    const needsCatalog = actSubmitLive && legacyWantsSubmit;
    if (needsCatalog) {
      try {
        catalog = await getCachedMenuForLocation(input.parsed.locationId);
      } catch {
        catalog = undefined;
      }
    }

    const actStarted = performance.now();
    actPhase = await executeActPhase({
      config: ctx.config,
      reflexTurn,
      aiSessionId: timelineAiSessionId ?? undefined,
      tableId: input.parsed.tableId,
      locationId: input.parsed.locationId,
      tableToken: input.parsed.sessionToken,
      sessionToken: input.parsed.tableSessionToken ?? input.parsed.sessionToken,
      deviceFingerprint: input.parsed.deviceFingerprint ?? undefined,
      deviceToken: input.parsed.deviceToken ?? undefined,
      cartDraft: cartDraftForAct,
      catalog,
      legacySubmitOrder: legacyWantsSubmit,
    });
    actMs = performance.now() - actStarted;
  }

  const actSubmitOutcome = resolveActSubmitOutcome(actPhase);

  let turnSubmitOutcome = actSubmitOutcome;
  const shouldRunUnifiedSubmit =
    Boolean(perceiveData.submitOrder) &&
    !turnSubmitOutcome.orderId &&
    Boolean(timelineAiSessionId) &&
    (!turnSubmitOutcome.attempted || Boolean(turnSubmitOutcome.submitError));

  if (shouldRunUnifiedSubmit && timelineAiSessionId) {
    const unifiedStarted = performance.now();
    turnSubmitOutcome = await executeTurnOrderSubmit(input.admin, {
      aiSessionId: timelineAiSessionId,
      locationId: input.parsed.locationId,
      tableToken: input.parsed.sessionToken,
      sessionToken: input.parsed.tableSessionToken ?? input.parsed.sessionToken,
      deviceFingerprint: input.parsed.deviceFingerprint,
      deviceToken: input.parsed.deviceToken,
      cartDraft: cartDraftForAct,
    });
    actMs += performance.now() - unifiedStarted;
  }

  if (
    actSubmitOutcome.attempted &&
    actSubmitOutcome.orderId &&
    timelineAiSessionId &&
    turnSubmitOutcome.orderId === actSubmitOutcome.orderId
  ) {
    await persistAiSessionAfterOrderSubmit(input.admin, {
      aiSessionId: timelineAiSessionId,
      orderId: actSubmitOutcome.orderId,
      orderNumber: actSubmitOutcome.orderNumber,
      awaitingApproval: actSubmitOutcome.awaitingApproval,
      source: "denis_act_acl",
    });
  }

  const actHandoffOutcome = await runHandoffAclFallback(input.admin, {
    config: ctx.config,
    reflexTurn,
    parsed: input.parsed,
    language: input.parsed.language,
    actHandoffOutcome: resolveActHandoffOutcome(actPhase, input.parsed.language),
  });
  const actOrderChangeOutcome = resolveActOrderChangeOutcome(
    actPhase,
    input.parsed.language
  );

  return {
    ctx,
    perceiveData,
    cartDraftForAct,
    actPhase,
    actSubmitLive,
    actSubmitOutcome,
    turnSubmitOutcome,
    actHandoffOutcome,
    actOrderChangeOutcome,
    allergyCtx,
    waiterObligation,
    pendingSlotActApplied,
    actMs,
  };
}
