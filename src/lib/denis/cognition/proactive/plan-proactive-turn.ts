import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import { planUtterance } from "@/lib/denis/cognition/tde/utterance-plan";
import { tryTemplateUtterance } from "@/lib/denis/cognition/tde/template-utterance";
import type { BeliefGraph, TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { ProactivePolicyReason } from "@/lib/denis/cognition/proactive/proactive-policy-types";
import { pickProactiveCandidate } from "@/lib/denis/cognition/proactive/pick-proactive-candidate";
import { detectWaiterObligationTell } from "@/lib/denis/cognition/waiter/detect-waiter-obligation-tell";
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
};

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
    return input.nudge.prompt?.trim() || input.nudge.message.trim() || null;
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

  const obligationTell = detectWaiterObligationTell(input.state, language);
  if (obligationTell) {
    const decided = decideProactiveTurnPlan({
      beliefs,
      candidate: obligationTell,
      sessionPhase: input.sessionPhase,
      config: input.config,
      cartLineCount: input.state.commerce.cart.visibleLines.length,
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

  const pick = pickProactiveCandidate({
    config: input.config,
    orders: input.orders,
    mental: input.state.mental,
    payload: {
      ...input.payload,
      sessionPhase: input.sessionPhase,
      hasSessionOrders: input.state.commerce.orders.length > 0,
      dismissedNudgeKeys:
        input.payload.dismissedNudgeKeys ??
        input.state.conversation.dismissedNudges,
    },
    messages,
    now: input.now,
  });

  const candidate = pick.candidate;
  const mentalGate: ProactiveMentalGateTrace | null = pick.policyTrace;

  if (!candidate) {
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
    cartLineCount: input.state.commerce.cart.visibleLines.length,
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
