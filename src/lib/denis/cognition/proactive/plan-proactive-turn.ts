import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { decideProactiveTurnPlan, commerceBlocksProactive } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import { planUtterance } from "@/lib/denis/cognition/tde/utterance-plan";
import { tryTemplateUtterance } from "@/lib/denis/cognition/tde/template-utterance";
import type { BeliefGraph, TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { OfferTimingKind } from "@/lib/denis/cognition/offer/offer-types";
import type {
  ProactivePolicyEvaluation,
  ProactivePolicyReason,
} from "@/lib/denis/cognition/proactive/proactive-policy-types";
import {
  pickProactiveCandidate,
  type PickProactiveCandidateResult,
} from "@/lib/denis/cognition/proactive/pick-proactive-candidate";
import { derivePartyIntelligence } from "@/lib/denis/venue/party/derive-party-intelligence";
import { detectWaiterObligationTell } from "@/lib/denis/cognition/waiter/detect-waiter-obligation-tell";
import { hasActiveServiceRecovery } from "@/lib/denis/cognition/recovery/service-recovery-timeline";
import { computeSessionCheckEuros } from "@/lib/denis/config/revenue-intelligence";
import {
  buildSessionExperienceScore,
  resolvePaidAnchorAt,
} from "@/lib/denis/commerce/session-experience-score";
import type { MentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import type {
  GuestProactiveNudge,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { SessionPhase } from "@/lib/scene/types";

export type ProactiveTurnMessages = {
  browse: string;
  dessert: string;
  slowKitchen: string;
  guestWelcome: string;
  browseFollowUp: string;
  billPrompt: string;
  orderDelay: string;
  popularityPair: string;
};

export type ProactiveMentalGateTrace = {
  mode: MentalModelMode;
  candidateKind: GuestProactiveNudge["kind"];
  allow: boolean;
  reason: ProactivePolicyReason | null;
  wouldBlock: boolean;
  enforced: boolean;
  evaluationChain: ProactivePolicyEvaluation[];
  timingKind: OfferTimingKind | null;
  topRankedKind: GuestProactiveNudge["kind"] | null;
  selectedKind: GuestProactiveNudge["kind"] | null;
};

function buildMentalGateTrace(
  pick: PickProactiveCandidateResult,
  timingKind: OfferTimingKind | null
): ProactiveMentalGateTrace | null {
  if (!pick.policyTrace) return null;
  return {
    ...pick.policyTrace,
    evaluationChain: pick.evaluationChain,
    timingKind,
    topRankedKind: pick.topRankedKind,
    selectedKind: pick.selectedKind,
  };
}

export type ProactiveTurnResult = {
  beliefs: BeliefGraph;
  turnPlan: TurnPlan | null;
  nudge: GuestProactiveNudge | null;
  message: string | null;
  skipped: boolean;
  skipReason: string | null;
  candidateKind: GuestProactiveNudge["kind"] | null;
  mentalGate?: ProactiveMentalGateTrace | null;
};

function resolveProactiveMessage(input: {
  nudge: GuestProactiveNudge;
  turnPlan: TurnPlan;
  beliefs: BeliefGraph;
  messages: ProactiveTurnMessages;
}): string | null {
  if (input.nudge.kind === "waiter_gap") {
    return input.nudge.message.trim() || null;
  }

  if (input.nudge.kind === "drink_pairing") {
    if (input.nudge.message.trim()) {
      return input.nudge.message.trim();
    }
    const utterance = planUtterance({
      beliefs: input.beliefs,
      turnPlan: input.turnPlan,
      topGoal: null,
    });
    return tryTemplateUtterance(utterance);
  }

  if (input.nudge.message.trim()) {
    return input.nudge.message.trim();
  }

  const utterance = planUtterance({
    beliefs: input.beliefs,
    turnPlan: input.turnPlan,
    topGoal: null,
  });
  return tryTemplateUtterance(utterance);
}

/**
 * D-PRO — proactive tick through FOLD beliefs → TDE → template tell (0 tokens).
 */
export function planProactiveTurn(input: {
  state: TableSessionState;
  config: ConciergeConfig;
  orders: AiGuestOrder[];
  payload: ProactiveTickPayload;
  sessionPhase: SessionPhase;
  messages?: Partial<ProactiveTurnMessages>;
  now?: number;
}): ProactiveTurnResult {
  const messages: ProactiveTurnMessages = {
    browse: input.messages?.browse ?? "Treba vam pomoć pri biranju?",
    dessert: input.messages?.dessert ?? "Spremni za desert?",
    slowKitchen:
      input.messages?.slowKitchen ??
      "Kuhinja radi intenzivno — želite nešto da popijete dok čekate?",
    guestWelcome:
      input.messages?.guestWelcome ?? "Dobrodošli! Da li ste već odlučili?",
    browseFollowUp:
      input.messages?.browseFollowUp ??
      "Da li ste već odlučili? Mogu li da pomognem?",
    billPrompt:
      input.messages?.billPrompt ??
      "Hoćete da zatvorimo račun? Možete platiti ovde ili pozvati konobara.",
    orderDelay:
      input.messages?.orderDelay ??
      "Vaša narudžbina se priprema, stiže uskoro. Hvala na strpljenju!",
    popularityPair:
      input.messages?.popularityPair ??
      "Gosti često uzmu i nešto uz to — hoćete da dodam?",
  };

  const beliefs = compileBeliefs({
    state: input.state,
    guestMessage: "",
  });

  const language =
    input.payload.language ??
    input.config.language.venueDefault ??
    "sr";

  const sessionCheckEuros = computeSessionCheckEuros(input.orders);
  const revenueStrategy = input.payload.revenueStrategy ?? null;
  const activeServiceRecovery = hasActiveServiceRecovery({
    timeline: input.state.timeline,
    blockMinutes: input.config.ops.serviceRecovery.reviewBlockMinutes,
  });

  const obligationTell = detectWaiterObligationTell(input.state, language);
  if (obligationTell) {
    const decided = decideProactiveTurnPlan({
      beliefs,
      candidate: obligationTell,
      sessionPhase: input.sessionPhase,
      config: input.config,
      cartLineCount: input.state.commerce.cart.visibleLines.length,
      revenueStrategy,
      sessionCheckEuros,
      mental: input.state.mental,
      activeServiceRecovery,
    });

    if (decided.ok && obligationTell.message.trim()) {
      return {
        beliefs,
        turnPlan: decided.plan,
        nudge: obligationTell,
        message: obligationTell.message.trim(),
        skipped: false,
        skipReason: null,
        candidateKind: "waiter_gap",
      };
    }
  }

  const partyFacts = input.state.party
    ? derivePartyIntelligence({
        party: input.state.party,
        orders: input.state.commerce.orders.map((order) => ({
          id: order.id,
          status: order.status,
          createdAt: order.createdAt,
          deviceFingerprint: order.deviceFingerprint,
          items: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
          })),
        })),
        nowMs: input.now,
      })
    : null;

  const cartLineCount = Math.max(
    input.state.commerce.cart.visibleLines.length,
    input.state.commerce.cart.ai.draft.items.length,
    input.payload.cartItemCount ?? 0
  );

  const pick = pickProactiveCandidate({
    config: input.config,
    orders: input.orders,
    orderFacts: input.state.commerce.orders,
    browse: input.state.browse,
    mental: input.state.mental,
    offer: input.state.offer,
    language,
    venueOps: input.state.venue.ops,
    opsEffects: input.state.venue.opsEffects,
    partyFacts,
    payload: {
      ...input.payload,
      sessionPhase: input.sessionPhase,
      hasSessionOrders: input.state.commerce.orders.length > 0,
      cartItemCount: cartLineCount,
      kdsStress: input.state.venue.ops.kdsStress,
      kitchenEstimatedWaitMinutes:
        input.payload.kitchenEstimatedWaitMinutes ??
        input.state.venue.opsEffects.capacityBanner?.estimatedWaitMinutes ??
        input.state.venue.ops.stationStress?.find(
          (station) => station.station === "kitchen"
        )?.avgWaitMinutes ??
        null,
      kitchenPendingCount:
        input.payload.kitchenPendingCount ??
        input.state.venue.ops.stationStress?.find(
          (station) => station.station === "kitchen"
        )?.activeCount ??
        0,
      dismissedNudgeKeys:
        input.payload.dismissedNudgeKeys ??
        input.state.conversation.dismissedNudges,
      cartAbandonedRemovedAt:
        input.payload.cartAbandonedRemovedAt ??
        input.state.browse.cartAbandoned[0]?.removedAt ??
        null,
      experienceScore: buildSessionExperienceScore(input.state).overallScore,
      googleReviewUrl: input.payload.googleReviewUrl ?? null,
      lastReviewPromptAt: input.state.guest?.lastReviewPromptAt ?? null,
      lastReviewDismissAt: input.state.guest?.lastReviewDismissAt ?? null,
      paidAnchorAt:
        input.payload.paidAnchorAt ??
        resolvePaidAnchorAt(input.state.commerce.orders),
      billSettled: input.state.session.billSettled,
      tipRecorded: input.state.commerce.orders.some(
        (order) => (order.tipAmount ?? 0) > 0
      ),
      waitingForBill: !input.state.session.billSettled,
      lastGuestMessage:
        input.state.conversation.model?.thread?.lastGuestText ?? null,
      mealStage: input.state.mental.mealStage ?? null,
      sessionDurationMinutes: (() => {
        const orders = input.state.commerce.orders;
        if (!orders.length) return null;
        const first = Math.min(
          ...orders
            .map((order) => Date.parse(order.createdAt))
            .filter(Number.isFinite)
        );
        if (!Number.isFinite(first)) return null;
        return Math.max(0, ((input.now ?? Date.now()) - first) / 60_000);
      })(),
      recoveryCompleted: input.payload.recoveryCompleted,
      postRecoveryEligible:
        input.payload.postRecoveryEligible ??
        (input.state.session.feedbackSubmitted &&
          input.state.session.feedbackSentiment === "negative"),
    },
    messages,
    now: input.now,
    revenueStrategy,
    sessionCheckEuros,
    guestMemory: input.state.guest ?? null,
    currentPartySize: partyFacts?.partySize ?? null,
    menuEngineeringCategories: input.payload.menuEngineeringCategories,
  });

  const candidate = pick.candidate;
  const mentalGate = buildMentalGateTrace(
    pick,
    input.state.offer?.trace.timing?.kind ?? null
  );

  if (!candidate) {
    const commerceActive =
      commerceBlocksProactive(beliefs, cartLineCount) ||
      Boolean(input.state.conversation.pendingSlot);

    if (commerceActive) {
      return {
        beliefs,
        turnPlan: null,
        nudge: null,
        message: null,
        skipped: true,
        skipReason: "commerce.active",
        candidateKind: mentalGate?.candidateKind ?? "browse_nudge",
        mentalGate,
      };
    }

    return {
      beliefs,
      turnPlan: null,
      nudge: null,
      message: null,
      skipped: true,
      skipReason: mentalGate?.reason ?? "no_candidate",
      candidateKind: mentalGate?.candidateKind ?? null,
      mentalGate,
    };
  }

  const decided = decideProactiveTurnPlan({
    beliefs,
    candidate,
    sessionPhase: input.sessionPhase,
    config: input.config,
    cartLineCount,
    revenueStrategy,
    sessionCheckEuros,
    mental: input.state.mental,
    activeServiceRecovery,
  });

  if (!decided.ok) {
    return {
      beliefs,
      turnPlan: null,
      nudge: null,
      message: null,
      skipped: true,
      skipReason: decided.reason,
      candidateKind: candidate.kind,
      mentalGate,
    };
  }

  const message = resolveProactiveMessage({
    nudge: candidate,
    turnPlan: decided.plan,
    beliefs,
    messages,
  });

  if (!message) {
    return {
      beliefs,
      turnPlan: decided.plan,
      nudge: null,
      message: null,
      skipped: true,
      skipReason: "empty_message",
      candidateKind: candidate.kind,
      mentalGate,
    };
  }

  return {
    beliefs,
    turnPlan: decided.plan,
    nudge: { ...candidate, message },
    message,
    skipped: false,
    skipReason: null,
    candidateKind: candidate.kind,
    mentalGate,
  };
}
