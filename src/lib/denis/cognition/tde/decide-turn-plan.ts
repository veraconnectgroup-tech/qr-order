import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import {
  CORE_BELIEF_KEYS,
  type ConversationMode,
  type DecideTurnPlanInput,
  getBeliefValue,
  type TurnPlan,
  type TurnPlanKind,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import type {
  CommercePressure,
  ConversationAwaiting,
} from "@/lib/denis/cognition/tde/turn-plan-types";

const VAGUE_RECOMMEND_PATTERN =
  /\b(preporu[čc]|empfehl|recommend|suggest|šta da|sta da|was (soll|empfehl)|what should|surprise me|izaberi|odaberi)\b/i;

const SETTLING_GUEST_PATTERN =
  /\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat|pay|rechnung bitte|that's it|done ordering)\b/i;

const ORDER_STATUS_QUERY_PATTERN =
  /\b(kad sti[žz]e|kada sti[žz]e|gde je|gdje je|where.*order|wo ist|when.*(arriv|ready|coming)|order status|status.*order|moje pivo|my beer|jesi\s+(poslao|poslala|poslali)|da\s+li\s+(ste|si)\s+posl|poslao\s+porud[žz]bin|poslata|poslat[aoe]?|nisam\s+dobio|nisi\s+dobio|nije\s+stiglo|not\s+(sent|received|arrived)|keine\s+bestellung|da\s+li\s+ste\s+saznal)\b/i;

const MISSING_ORDER_COMPLAINT_PATTERN =
  /\b(nisi poslao|nije poslat|not sent|keine bestellung|order.*not.*(sent|received)|waiter says|konobar ka[žz]e|nisam dobio|nisi dobio|nije stiglo|gde je pivo|gdje je pivo)\b/i;

/** @deprecated Routing hint only — not an LLM gate (ADR-025). */
const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|weizen|pilsner|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|schnitzel|pils|espresso|latte|molim|bitte|please|ho[ćc]u|želim|zelim|jedno|jedna|malo|veliko)\b/i;

/** Social / banter — not an order line (eval helpers only; ADR-025). */
export function isCasualSocialGuestMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  if (ORDERING_GUEST_PATTERN.test(text)) return false;
  return true;
}

export function looksLikeOrderLine(message: string): boolean {
  return ORDERING_GUEST_PATTERN.test(message.trim());
}

function resolveConversationMode(
  input: DecideTurnPlanInput
): ConversationMode {
  const fromBelief = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (fromBelief) return fromBelief;
  if (SETTLING_GUEST_PATTERN.test(input.message)) return "settling";
  return "banter";
}

function resolveSuppressUpsell(beliefs: DecideTurnPlanInput["beliefs"]): boolean {
  return (
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell) === true ||
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueRush) === true
  );
}

/** ADR-031 C2 — guest replies always comprehend or deterministic ACT; never slot template loop. */
function planForPendingSlot(
  _slot: string,
  _message: string,
  suppressUpsell: boolean
): TurnPlan {
  return buildPlan("transactional_perceive", {
    requiresLlm: true,
    suppressUpsell,
    reason: "commerce.pending_slot.reply",
  });
}

function planForTopGoal(
  goal: DenisGoal | null,
  suppressUpsell: boolean
): TurnPlan | null {
  if (!goal) return null;

  if (goal.type === "RECONCILE_CART") {
    return {
      kind: "template_tell",
      requiresLlm: false,
      suppressUpsell,
      reason: "goal.reconcile_cart",
      templateKey: "cart.conflict",
    };
  }

  if (goal.type === "CLARIFY_SLOT") {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "goal.clarify_slot.reply",
    });
  }

  if (goal.type === "INFORM_STATUS") {
    return {
      kind: "template_tell",
      requiresLlm: false,
      suppressUpsell,
      reason: "goal.inform_status",
      templateKey: "status.headline",
    };
  }

  if (goal.type === "UPSELL_ONCE" && suppressUpsell) {
    return null;
  }

  return null;
}

function planForCommittedFacts(
  facts: DecideTurnPlanInput["committedFacts"],
  suppressUpsell: boolean
): TurnPlan | null {
  if (!facts?.length) return null;
  return {
    kind: "narrate_paraphrase",
    requiresLlm: true,
    suppressUpsell,
    reason: "committed_facts",
  };
}

function buildPlan(
  kind: TurnPlanKind,
  partial: Omit<TurnPlan, "kind">
): TurnPlan {
  return { kind, ...partial };
}

const PURE_SOCIAL_BANTER_PATTERN =
  /^(zdravo|ćao|cao|hello|hi|hey|guten tag|guten abend|merhaba|que tal|ciao|hola)[\s,!.-]*((kako si|how are|sta si|sta ima|legendo|legend).*)?$/i;

function isPureSocialBanter(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 120) return false;
  return PURE_SOCIAL_BANTER_PATTERN.test(text);
}

function hasCommercePressure(input: DecideTurnPlanInput): boolean {
  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const mode = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );

  return (
    pressure === "open" ||
    pressure === "confirm" ||
    awaiting != null ||
    Boolean(pendingSlot) ||
    mode === "ordering"
  );
}

/** ADR-030 — comprehend-first perceive after deterministic exits. */
function resolvePerceivePlan(
  input: DecideTurnPlanInput,
  suppressUpsell: boolean
): TurnPlan {
  const mode = resolveConversationMode(input);
  const message = input.message.trim();
  const commerceActive = hasCommercePressure(input);

  if (mode === "settling") {
    const pressure = getBeliefValue<CommercePressure>(
      input.beliefs,
      CORE_BELIEF_KEYS.commercePressure
    );
    const pendingSlot = getBeliefValue<string>(
      input.beliefs,
      CORE_BELIEF_KEYS.commercePendingSlot
    );
    if (pressure === "open" || pressure === "confirm" || pendingSlot) {
      return buildPlan("transactional_perceive", {
        requiresLlm: true,
        suppressUpsell,
        reason: "commerce.unsent_cart.settling_blocked",
      });
    }

    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "conversation.mode.settling",
      templateKey: "settle.thanks",
    });
  }

  if (VAGUE_RECOMMEND_PATTERN.test(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "vague_recommend",
    });
  }

  if (!commerceActive && isPureSocialBanter(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "conversation.pure_social",
    });
  }

  return buildPlan("transactional_perceive", {
    requiresLlm: true,
    suppressUpsell,
    reason: commerceActive
      ? "commerce.pressure.comprehend"
      : "comprehend_first.default",
  });
}

/** ADR-030 — LLM confirm at recap; T0 cart edits (add/remove) stay reflex_only. */
function shouldComprehendConfirmTurn(input: DecideTurnPlanInput): boolean {
  if (!input.message.trim()) return false;

  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const atConfirmPressure = pressure === "confirm" || awaiting === "confirm";
  const intent = input.reflex.reflex?.intent;

  if (intent === "CONFIRM" || intent === "DECLINE") return true;
  if (intent === "DONE" && atConfirmPressure) return true;

  if (!atConfirmPressure) return false;

  // T0 cart edits at recap (add/remove) — reflex_only; confirm/DONE handled above.
  if (input.reflex.usedT0 && intent !== "DONE") {
    return false;
  }

  return true;
}

/**
 * ADR-023 §4 + ADR-025 — single code path between FOLD and perceive.
 * Director decides LLM vs template; does not call OpenAI.
 */
export function decideTurnPlan(input: DecideTurnPlanInput): TurnPlan {
  const suppressUpsell = resolveSuppressUpsell(input.beliefs);

  // ADR-030 — at recap, LLM comprehends confirm in any language; T0 is optional fast-path only.
  if (shouldComprehendConfirmTurn(input)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.awaiting_confirm.comprehend",
    });
  }

  if (input.reflex.usedT0 || input.reflex.handoffCommand) {
    return buildPlan("reflex_only", {
      requiresLlm: false,
      suppressUpsell,
      reason: "t0_reflex_or_handoff",
    });
  }

  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (pendingSlot) {
    return planForPendingSlot(pendingSlot, input.message, suppressUpsell);
  }

  const goalPlan = planForTopGoal(input.reflex.plan.topGoal, suppressUpsell);
  if (goalPlan) return goalPlan;

  const hasOpenOrders =
    getBeliefValue<boolean>(input.beliefs, CORE_BELIEF_KEYS.commerceHasOpenOrders) ===
    true;

  if (
    ORDER_STATUS_QUERY_PATTERN.test(input.message.trim()) &&
    !hasOpenOrders
  ) {
    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "commerce.status.no_open_order",
      templateKey: "status.no_order",
    });
  }

  if (MISSING_ORDER_COMPLAINT_PATTERN.test(input.message.trim())) {
    if (!hasOpenOrders) {
      return buildPlan("template_tell", {
        requiresLlm: false,
        suppressUpsell,
        reason: "commerce.order_not_sent.complaint",
        templateKey: "status.no_order",
      });
    }
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.order_not_sent.complaint_with_open_order",
    });
  }

  const narratePlan = planForCommittedFacts(
    input.committedFacts,
    suppressUpsell
  );
  if (narratePlan) return narratePlan;

  return resolvePerceivePlan(input, suppressUpsell);
}

/** Whether DECIDE may attach upsell goals for this turn (MR-2 acceptance). */
export function turnPlanAllowsUpsell(
  plan: TurnPlan,
  topGoal: DenisGoal | null
): boolean {
  if (plan.suppressUpsell) return false;
  if (plan.kind === "reflex_only" || plan.kind === "transactional_perceive") {
    return false;
  }
  if (topGoal?.type === "UPSELL_ONCE") return true;
  return plan.kind === "relational_perceive";
}
