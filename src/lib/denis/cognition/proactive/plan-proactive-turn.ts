import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import { planUtterance } from "@/lib/denis/cognition/tde/utterance-plan";
import { tryTemplateUtterance } from "@/lib/denis/cognition/tde/template-utterance";
import type { BeliefGraph, TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { detectProactiveCandidate } from "@/lib/denis/cognition/proactive/detect-proactive-candidate";
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

export type ProactiveTurnResult = {
  beliefs: BeliefGraph;
  turnPlan: TurnPlan | null;
  nudge: GuestProactiveNudge | null;
  message: string | null;
  skipped: boolean;
  skipReason: string | null;
  candidateKind: GuestProactiveNudge["kind"] | null;
};

function resolveProactiveMessage(input: {
  nudge: GuestProactiveNudge;
  turnPlan: TurnPlan;
  beliefs: BeliefGraph;
  messages: ProactiveTurnMessages;
}): string | null {
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

  const candidate = detectProactiveCandidate({
    config: input.config,
    orders: input.orders,
    payload: {
      ...input.payload,
      hasSessionOrders: input.state.commerce.orders.length > 0,
      dismissedNudgeKeys:
        input.payload.dismissedNudgeKeys ??
        input.state.conversation.dismissedNudges,
    },
    messages,
    now: input.now,
  });

  if (!candidate) {
    return {
      beliefs,
      turnPlan: null,
      nudge: null,
      message: null,
      skipped: true,
      skipReason: "no_candidate",
      candidateKind: null,
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
  };
}
