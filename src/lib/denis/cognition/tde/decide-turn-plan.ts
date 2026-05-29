import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import {
  CORE_BELIEF_KEYS,
  type ConversationMode,
  type DecideTurnPlanInput,
  getBeliefValue,
  type TurnPlan,
  type TurnPlanKind,
} from "@/lib/denis/cognition/tde/turn-plan-types";

const VAGUE_RECOMMEND_PATTERN =
  /\b(preporu[čc]|empfehl|recommend|suggest|šta da|sta da|was (soll|empfehl)|what should|surprise me|izaberi|odaberi)\b/i;

const SETTLING_GUEST_PATTERN =
  /\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat|pay|rechnung bitte|that's it|done ordering)\b/i;

/** @deprecated Routing hint only — not an LLM gate (ADR-025). */
const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|schnitzel|pils|espresso|latte)\b/i;

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

function planForPendingSlot(
  slot: string,
  suppressUpsell: boolean
): TurnPlan {
  const templateKey =
    slot === "serve_size" ? "slot.clarify.serve_size" : "slot.clarify.generic";
  return {
    kind: "slot_extract",
    requiresLlm: false,
    suppressUpsell,
    reason: "commerce.pending_slot",
    templateKey,
  };
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
    const slotKind = goal.slot.kind;
    return planForPendingSlot(slotKind, suppressUpsell);
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

function hasCommercePressure(mode: ConversationMode): boolean {
  return mode === "ordering";
}

/** ADR-025 — state-driven perceive branch after deterministic exits. */
function resolvePerceivePlan(
  input: DecideTurnPlanInput,
  suppressUpsell: boolean
): TurnPlan {
  const mode = resolveConversationMode(input);
  const message = input.message.trim();

  if (mode === "settling") {
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

  if (hasCommercePressure(mode)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "conversation.mode.ordering",
    });
  }

  return buildPlan("relational_perceive", {
    requiresLlm: true,
    suppressUpsell,
    reason: "conversation.free_text",
  });
}

/**
 * ADR-023 §4 + ADR-025 — single code path between FOLD and perceive.
 * Director decides LLM vs template; does not call OpenAI.
 */
export function decideTurnPlan(input: DecideTurnPlanInput): TurnPlan {
  const suppressUpsell = resolveSuppressUpsell(input.beliefs);

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
    return planForPendingSlot(pendingSlot, suppressUpsell);
  }

  const goalPlan = planForTopGoal(input.reflex.plan.topGoal, suppressUpsell);
  if (goalPlan) return goalPlan;

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
