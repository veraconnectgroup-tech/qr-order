import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type PlanUtteranceInput,
  type TurnPlan,
  type UtteranceIntent,
  type UtterancePlan,
} from "@/lib/denis/cognition/tde/turn-plan-types";

function resolveLanguage(beliefs: PlanUtteranceInput["beliefs"]): string {
  return (
    getBeliefValue<string>(beliefs, CORE_BELIEF_KEYS.conversationLanguage) ??
    "en"
  );
}

function intentForTurnPlan(
  turnPlan: TurnPlan
): { intent: UtteranceIntent; templateKey: string } {
  switch (turnPlan.kind) {
    case "slot_extract":
      return {
        intent: "slot_clarify",
        templateKey: turnPlan.templateKey ?? "slot.clarify.generic",
      };
    case "template_tell":
      if (turnPlan.templateKey === "settle.thanks") {
        return { intent: "settle_thanks", templateKey: "settle.thanks" };
      }
      if (turnPlan.templateKey === "cart.conflict") {
        return { intent: "cart_conflict", templateKey: "cart.conflict" };
      }
      if (turnPlan.templateKey === "status.headline") {
        return { intent: "status_headline", templateKey: "status.headline" };
      }
      if (turnPlan.templateKey === "status.no_order") {
        return { intent: "status_no_order", templateKey: "status.no_order" };
      }
      if (turnPlan.templateKey?.startsWith("waiter.gap_clarify")) {
        return {
          intent: "slot_clarify",
          templateKey: turnPlan.templateKey,
        };
      }
      if (turnPlan.templateKey?.startsWith("proactive.")) {
        return {
          intent: "generic_nudge",
          templateKey: turnPlan.templateKey,
        };
      }
      if (turnPlan.templateKey === "offer.recommend") {
        return {
          intent: "generic_nudge",
          templateKey: "offer.recommend",
        };
      }
      return {
        intent: "banter_welcome",
        templateKey: turnPlan.templateKey ?? "banter.welcome",
      };
    case "relational_perceive":
      return { intent: "banter_welcome", templateKey: "banter.welcome" };
    case "narrate_paraphrase":
      return { intent: "generic_nudge", templateKey: "banter.welcome" };
    default:
      return { intent: "generic_nudge", templateKey: "banter.welcome" };
  }
}

/**
 * ADR-023 §3.4 — map beliefs + turn plan → utterance plan (template before LLM).
 */
export function planUtterance(input: PlanUtteranceInput): UtterancePlan {
  const language = resolveLanguage(input.beliefs);
  const { intent, templateKey } = intentForTurnPlan(input.turnPlan);

  const useTemplate =
    input.turnPlan.kind === "template_tell" ||
    input.turnPlan.kind === "slot_extract" ||
    (input.turnPlan.kind === "relational_perceive" && !input.turnPlan.requiresLlm);

  const requiresNarrateLlm =
    input.turnPlan.kind === "narrate_paraphrase" ||
    (input.turnPlan.requiresLlm && !useTemplate);

  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );

  return {
    intent,
    language,
    templateKey,
    facts: {
      suppressUpsell: input.turnPlan.suppressUpsell,
      pendingSlot,
      topGoalType: input.topGoal?.type,
      turnKind: input.turnPlan.kind,
      reason: input.turnPlan.reason,
    },
    useTemplate,
    requiresNarrateLlm,
  };
}

/** Upsell nudge only when plan allows and goal stack still has UPSELL_ONCE. */
export function utteranceIncludesUpsellNudge(input: PlanUtteranceInput): boolean {
  if (input.turnPlan.suppressUpsell) return false;
  if (input.topGoal?.type !== "UPSELL_ONCE") return false;
  return input.turnPlan.kind !== "transactional_perceive";
}
