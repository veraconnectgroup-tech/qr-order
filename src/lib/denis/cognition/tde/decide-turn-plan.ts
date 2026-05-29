import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import {
  CORE_BELIEF_KEYS,
  type ConversationMode,
  type DecideTurnPlanInput,
  getBeliefValue,
  type TurnPlan,
  type TurnPlanKind,
} from "@/lib/denis/cognition/tde/turn-plan-types";

const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|schnitzel|pils|espresso|latte)\b/i;

const VAGUE_RECOMMEND_PATTERN =
  /\b(preporu[čc]|empfehl|recommend|suggest|šta da|sta da|was (soll|empfehl)|what should|surprise me|izaberi|odaberi)\b/i;

function normalize(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Social / banter — not an order line (ADR-023 MR-2; no src/lib/ai import). */
export function isCasualSocialGuestMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  if (ORDERING_GUEST_PATTERN.test(text)) return false;
  return true;
}

export function looksLikeOrderLine(message: string): boolean {
  return ORDERING_GUEST_PATTERN.test(message.trim());
}

function inferConversationMode(message: string): ConversationMode | null {
  if (looksLikeOrderLine(message)) return "ordering";
  if (isCasualSocialGuestMessage(message)) return "banter";
  if (/\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat)\b/i.test(message)) {
    return "settling";
  }
  return null;
}

function resolveConversationMode(
  input: DecideTurnPlanInput
): ConversationMode {
  const fromBelief = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (fromBelief) return fromBelief;
  return inferConversationMode(input.message) ?? "ordering";
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

function planForBanter(suppressUpsell: boolean): TurnPlan {
  return {
    kind: "template_tell",
    requiresLlm: false,
    suppressUpsell,
    reason: "conversation.mode.banter",
    templateKey: "banter.welcome",
  };
}

function planForOrdering(suppressUpsell: boolean): TurnPlan {
  return {
    kind: "transactional_perceive",
    requiresLlm: true,
    suppressUpsell,
    reason: "conversation.mode.ordering",
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

/**
 * ADR-023 §4 — single code path between FOLD and perceive.
 * Director decides LLM vs template; does not call OpenAI.
 */
export function decideTurnPlan(input: DecideTurnPlanInput): TurnPlan {
  const suppressUpsell = resolveSuppressUpsell(input.beliefs);
  const message = input.message.trim();

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

  const mode = resolveConversationMode(input);

  if (mode === "banter" || isCasualSocialGuestMessage(message)) {
    if (VAGUE_RECOMMEND_PATTERN.test(message)) {
      return buildPlan("relational_perceive", {
        requiresLlm: true,
        suppressUpsell,
        reason: "banter.vague_recommend",
      });
    }
    return planForBanter(suppressUpsell);
  }

  if (mode === "settling") {
    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "conversation.mode.settling",
      templateKey: "settle.thanks",
    });
  }

  if (mode === "ordering" || looksLikeOrderLine(message)) {
    return planForOrdering(suppressUpsell);
  }

  if (VAGUE_RECOMMEND_PATTERN.test(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "vague_recommend",
    });
  }

  return buildPlan("template_tell", {
    requiresLlm: false,
    suppressUpsell,
    reason: "default_nudge",
    templateKey: "banter.welcome",
  });
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
