import type { BeliefGraph } from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type ConversationMode,
  type CommercePressure,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import type {
  InterpretationEvidenceBudget,
  InterpretationSchema,
  InterpretationTask,
} from "@/lib/denis/cognition/tde/interpretation-task-types";

function hasCommercePressure(beliefs: BeliefGraph): boolean {
  const pressure = getBeliefValue<CommercePressure>(
    beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<string | null>(
    beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const mode = getBeliefValue<ConversationMode>(
    beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  const pendingSlot = getBeliefValue<string>(
    beliefs,
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

function directiveBlock(
  goalType: DenisGoal["type"],
  schema: InterpretationSchema
): string {
  return [
    "INTERPRETATION TASK (goal-directed L3):",
    `goal: ${goalType}`,
    `schema: ${schema}`,
    "Follow schema over message keyword heuristics — regex hints must not override this goal.",
  ].join("\n");
}

function baseBudget(
  partial: Omit<InterpretationEvidenceBudget, "pointers"> & {
    pointers?: InterpretationEvidenceBudget["pointers"];
  }
): InterpretationEvidenceBudget {
  return {
    pointers: partial.pointers ?? ["commerce.*", "transcript.window", "situation.pack"],
    ...partial,
  };
}

function transactionalTask(
  goalType: DenisGoal["type"],
  reason: string
): InterpretationTask {
  const schema: InterpretationSchema =
    goalType === "CLARIFY_SLOT" ? "slot_reply" : "transactional_order";

  return {
    schema,
    planKind: "transactional_perceive",
    goalType,
    reason,
    directiveBlock: directiveBlock(goalType, schema),
    evidenceBudget: baseBudget({
      perceiveMode: "commerce",
      includeCatalogRag: true,
      includePlaybook: true,
      omitFullMenuWhenNoRag: false,
    }),
  };
}

function relationalTask(
  goalType: DenisGoal["type"],
  reason: string,
  schema: InterpretationSchema = "relational_social",
  budget?: Partial<InterpretationEvidenceBudget>
): InterpretationTask {
  return {
    schema,
    planKind: "relational_perceive",
    goalType,
    reason,
    directiveBlock: directiveBlock(goalType, schema),
    evidenceBudget: baseBudget({
      perceiveMode: "social",
      includeCatalogRag: schema === "upsell_nudge",
      includePlaybook: true,
      omitFullMenuWhenNoRag: true,
      ...budget,
    }),
  };
}

/**
 * Table OS L3 — topGoal + beliefs → schema-driven perceive task (ARCH-7 / C12).
 * Returns null when no top goal — caller falls back to legacy regex perceive routing.
 */
export function buildInterpretationTask(
  topGoal: DenisGoal | null,
  beliefs: BeliefGraph
): InterpretationTask | null {
  if (!topGoal) return null;

  switch (topGoal.type) {
    case "RECONCILE_CART":
    case "INFORM_STATUS":
      return null;

    case "CLARIFY_SLOT":
      return transactionalTask(topGoal.type, "goal.clarify_slot.interpret");

    case "COMPLETE_ROUND": {
      const transactional = hasCommercePressure(beliefs);
      if (transactional) {
        return transactionalTask(
          topGoal.type,
          "goal.complete_round.transactional"
        );
      }
      return relationalTask(
        topGoal.type,
        "goal.complete_round.social",
        "relational_social"
      );
    }

    case "UPSELL_ONCE":
      return relationalTask(
        topGoal.type,
        "goal.upsell_once.relational",
        "upsell_nudge",
        {
          includeCatalogRag: true,
          omitFullMenuWhenNoRag: true,
        }
      );

    case "GUEST_SEATED": {
      const transactional =
        hasCommercePressure(beliefs) ||
        getBeliefValue<ConversationMode>(
          beliefs,
          CORE_BELIEF_KEYS.conversationMode
        ) === "ordering";
      if (transactional) {
        return transactionalTask(topGoal.type, "goal.guest_seated.ordering");
      }
      return relationalTask(topGoal.type, "goal.guest_seated.social");
    }

    case "HANDOFF":
      return transactionalTask(topGoal.type, "goal.handoff.transactional");

    case "CLOSE_VISIT":
      return relationalTask(topGoal.type, "goal.close_visit.social");

    default:
      return null;
  }
}

/** Partial turn plan fields from L3 task — pass to buildPlan(kind, …). */
export function turnPlanFromInterpretationTask(
  task: InterpretationTask,
  suppressUpsell: boolean
): Omit<import("@/lib/denis/cognition/tde/turn-plan-types").TurnPlan, "kind"> {
  return {
    requiresLlm: true,
    suppressUpsell,
    reason: task.reason,
  };
}
