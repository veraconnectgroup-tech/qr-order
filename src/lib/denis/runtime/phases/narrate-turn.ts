import { isDenisRefusalReply } from "@/lib/ai/conversation-leadership";
import { resolveGuestLegacyPath } from "@/lib/denis/config/rollout";
import {
  enforceWaiterTell,
} from "@/lib/denis/cognition/waiter";
import { sanitizeGuestOrderHonesty } from "@/lib/denis/cognition/order";
import {
  buildNarrationFacts,
  resolveTurnQuickReplies,
  sanitizeNarrationOutput,
} from "@/lib/denis/runtime/narrate";
import { resolveTurnNarrationMessage } from "@/lib/denis/runtime/narrate/resolve-turn-narration";
import {
  orderSubmitNotAttemptedMessage,
  orderSubmitSuccessMessage,
} from "@/lib/denis/runtime/act/commit-outcome-messages";
import { diffShadowTurn } from "@/lib/denis/runtime/shadow-diff";
import { shouldRunShadowDiff } from "@/lib/denis/config/rollout";
import {
  buildCommerceStatusSummary,
  cartDraftToAiOrderDraft,
  dedupeHandoffQuickReplies,
} from "@/lib/denis/runtime/phases/turn-cart-helpers";
import type {
  ActOnTurnResult,
  NarrateTurnResult,
  PerceiveTurnResult,
  PreparedTurnContext,
} from "@/lib/denis/runtime/phases/phase-types";
import type { DenisChatBody } from "@/lib/denis/runtime/turn-types";
import { logger } from "@/lib/logger";

export async function narrateTurn(input: {
  parsed: DenisChatBody;
  prepared: PreparedTurnContext;
  perceive: PerceiveTurnResult;
  act: ActOnTurnResult;
  traceId: string;
  channel: "chat" | "voice";
  creditBalanceAfter: number;
}): Promise<NarrateTurnResult> {
  const { ctx } = input.act;
  const { perceiveResult, reflexTurn, slotExtract, rolloutMode } = input.perceive;
  const perceiveData = input.act.perceiveData;

  const guestUsesLegacy = resolveGuestLegacyPath(rolloutMode, {
    cohortKey: input.parsed.sessionToken,
    canaryPercent: ctx.config.rollout.canaryPercent,
  });

  const narrationFacts = buildNarrationFacts({
    config: ctx.config,
    language: input.parsed.language,
    reflexTurn,
    flowNodeId: ctx.flowNodeId,
    guestMemory: ctx.guestMemory,
    cartActions: perceiveData.cartActions,
    recommendations: perceiveData.recommendations,
    orderNumber: input.act.turnSubmitOutcome.orderNumber ?? null,
    statusSummary: buildCommerceStatusSummary(
      ctx.tableSessionState?.commerce.orders ?? []
    ),
    blockedReason: input.act.turnSubmitOutcome.guestBlockedReason ?? null,
    handoffMessage:
      input.act.actOrderChangeOutcome.guestMessage ??
      input.act.actHandoffOutcome.guestMessage ??
      null,
    venueOps: ctx.venueOps,
    opsEffects: ctx.opsEffects,
  });

  const narrateStarted = performance.now();
  const templateObligationTell =
    !perceiveResult.llmUsed &&
    (perceiveResult.turnPlan.reason === "waiter.gap_clarify" ||
      perceiveResult.turnPlan.reason === "waiter.gap_blocks_confirm" ||
      perceiveResult.turnPlan.reason === "waiter.gap_resolved.drink_reply" ||
      perceiveResult.turnPlan.reason === "commerce.confirm.reflex_submit");

  const resolvedNarration = await resolveTurnNarrationMessage({
    legacyMessage: perceiveData.message ?? "",
    facts: narrationFacts,
    config: ctx.config,
    rolloutMode,
    guestUsesLegacy,
    keepLegacyTell: templateObligationTell,
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
      legacyQuickReplies: perceiveData.quickReplies,
      language: input.parsed.language,
    }),
    input.act.actHandoffOutcome.quickReplies
  );
  const cartChangedThisTurn = (perceiveData.cartActions?.length ?? 0) > 0;
  let guestMessage =
    input.act.actOrderChangeOutcome.overrideLegacy && input.act.actOrderChangeOutcome.guestMessage
      ? input.act.actOrderChangeOutcome.guestMessage
      : input.act.actHandoffOutcome.overrideLegacy && input.act.actHandoffOutcome.guestMessage
        ? input.act.actHandoffOutcome.guestMessage
        : (input.act.pendingSlotActApplied || cartChangedThisTurn) && perceiveData.message?.trim()
          ? perceiveData.message
          : !resolvedNarration.usedDenisNarrator
            ? perceiveData.message
            : narration.message;

  if (input.act.turnSubmitOutcome.orderId) {
    guestMessage = orderSubmitSuccessMessage({
      language: input.parsed.language,
      orderNumber: input.act.turnSubmitOutcome.orderNumber,
      awaitingApproval: input.act.turnSubmitOutcome.awaitingApproval,
    });
  } else if (input.act.turnSubmitOutcome.guestBlockedReason && !input.act.turnSubmitOutcome.orderId) {
    guestMessage = input.act.turnSubmitOutcome.guestBlockedReason;
  } else if (
    Boolean(perceiveData.submitOrder) &&
    input.act.actSubmitLive &&
    !input.act.turnSubmitOutcome.attempted
  ) {
    guestMessage = orderSubmitNotAttemptedMessage(input.parsed.language);
  }

  guestMessage = sanitizeGuestOrderHonesty({
    message: guestMessage ?? "",
    language: input.parsed.language,
    orderSubmitted: Boolean(input.act.turnSubmitOutcome.orderId),
    draft: cartDraftToAiOrderDraft(input.act.cartDraftForAct),
  });

  if (!input.act.turnSubmitOutcome.orderId && input.act.waiterObligation.gaps.length > 0) {
    const tellBase =
      !input.act.waiterObligation.canConfirm &&
      guestMessage &&
      /\b(šaljem|saljem|send(ing)? (your )?order)\b/i.test(guestMessage)
        ? ""
        : (guestMessage ?? "");
    guestMessage = enforceWaiterTell({
      message: tellBase,
      obligation: input.act.waiterObligation,
      language: input.parsed.language,
      draft: cartDraftToAiOrderDraft(input.act.cartDraftForAct),
    });
  }

  const narrateMs = performance.now() - narrateStarted;

  let shadowParityScore: number | undefined;
  if (shouldRunShadowDiff(rolloutMode)) {
    const shadowDiff = diffShadowTurn({
      legacy: {
        intent: perceiveData.intent,
        message: perceiveData.message,
        cartActionCount: perceiveData.cartActions?.length ?? 0,
        submitOrder: perceiveData.submitOrder,
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
      traceId: input.traceId,
      rolloutMode,
      parityScore: shadowDiff.parityScore,
      mismatches: shadowDiff.mismatches,
      slotItemCount: slotExtract?.items.length ?? 0,
      slotTier: slotExtract?.tier ?? null,
    });
    shadowParityScore = shadowDiff.parityScore;
  }

  const creditsRemaining =
    perceiveData.creditsRemaining ?? input.creditBalanceAfter;

  const responseData = {
    message: guestMessage,
    recommendations: perceiveData.recommendations,
    proposedItems: perceiveData.proposedItems ?? [],
    cartActions: perceiveData.cartActions,
    quickReplies,
    intent: perceiveData.intent,
    submitOrder: Boolean(input.act.turnSubmitOutcome.orderId),
    creditsRemaining,
    sessionId: input.perceive.timelineAiSessionId ?? perceiveData.sessionId,
    ...(input.act.actHandoffOutcome.openPaymentSheet
      ? { openPaymentSheet: true }
      : {}),
    ...(input.act.turnSubmitOutcome.attempted && input.act.turnSubmitOutcome.orderId
      ? {
          orderSubmit: {
            orderId: input.act.turnSubmitOutcome.orderId,
            orderNumber: input.act.turnSubmitOutcome.orderNumber,
            awaitingApproval: input.act.turnSubmitOutcome.awaitingApproval ?? false,
            sessionOpened: input.act.turnSubmitOutcome.sessionOpened,
          },
        }
      : {}),
  };

  const responseMeta = {
    traceId: input.traceId,
    channel: input.channel,
    flowNodeId: reflexTurn.plan.transition.toNodeId,
    topGoal: reflexTurn.plan.topGoal?.type ?? null,
    conflictPrompt: reflexTurn.conflict?.guestPrompt ?? null,
    narrationTier: narration.tier,
    lintPassed: narration.lintPassed,
    usedNarrationFallback: narration.usedFallback,
    rolloutMode,
    partyMode: ctx.config.party.mode,
    partyDeviceCount: ctx.party?.activeDeviceCount ?? 0,
    isPrimaryDevice: ctx.party?.isCurrentDevicePrimary ?? false,
    sharedAiSessionId: ctx.party?.sharedAiSessionId ?? null,
    operatingMode: ctx.venueOps?.operatingMode,
    kdsStress: ctx.venueOps?.kdsStress,
    actSubmitLive: input.act.actSubmitLive,
    actSubmitAttempted: input.act.turnSubmitOutcome.attempted,
    actOrderNumber: input.act.turnSubmitOutcome.orderNumber,
    healthStatus: input.prepared.healthEvaluation.status,
  };

  return {
    guestMessage,
    quickReplies,
    narration: {
      message: narration.message,
      tier: narration.tier,
      lintPassed: narration.lintPassed,
      usedFallback: narration.usedFallback,
    },
    shadowParityScore,
    guestUsesLegacy,
    narrateMs,
    responseData,
    responseMeta,
  };
}
