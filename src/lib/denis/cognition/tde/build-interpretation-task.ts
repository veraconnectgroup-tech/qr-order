import type { BeliefGraph } from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type ConversationMode,
  type CommercePressure,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  resolveAdaptiveContextBudget,
  type TurnComplexity,
} from "@/lib/denis/cognition/context/context-budget";
import type { ConversationGraph } from "@/lib/denis/cognition/conversation/conversation-graph";
import { buildTopicInterpretationDirective } from "@/lib/denis/cognition/conversation/topic-tracker";
import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import type {
  InterpretationEvidenceBudget,
  InterpretationSchema,
  InterpretationTask,
} from "@/lib/denis/cognition/tde/interpretation-task-types";

export type InterpretationBudgetInput = {
  guestMessage?: string;
  conversationGraph?: ConversationGraph | null;
  maxContextTokens?: number;
  minContextTokens?: number;
  adaptiveContext?: boolean;
};

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
  partial: Omit<
    InterpretationEvidenceBudget,
    "pointers" | "contextTokenBudget" | "turnComplexity"
  > & {
    pointers?: InterpretationEvidenceBudget["pointers"];
    contextTokenBudget?: number;
    turnComplexity?: TurnComplexity;
  }
): InterpretationEvidenceBudget {
  return {
    pointers: partial.pointers ?? ["commerce.*", "transcript.window", "situation.pack"],
    contextTokenBudget: partial.contextTokenBudget ?? 2000,
    turnComplexity: partial.turnComplexity ?? "moderate",
    ...partial,
  };
}

function resolveTaskContextBudget(
  beliefs: BeliefGraph,
  budgetInput?: InterpretationBudgetInput
): Pick<InterpretationEvidenceBudget, "contextTokenBudget" | "turnComplexity"> {
  const guestMessage = budgetInput?.guestMessage ?? "";
  const resolved = resolveAdaptiveContextBudget({
    guestMessage,
    maxContextTokens: budgetInput?.maxContextTokens ?? 2000,
    minContextTokens: budgetInput?.minContextTokens ?? 500,
    adaptiveEnabled: budgetInput?.adaptiveContext,
    beliefs,
  });
  return {
    contextTokenBudget: resolved.tokenBudget,
    turnComplexity: resolved.complexity,
  };
}

function transactionalTask(
  goalType: DenisGoal["type"],
  reason: string,
  contextBudget: Pick<
    InterpretationEvidenceBudget,
    "contextTokenBudget" | "turnComplexity"
  >
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
      ...contextBudget,
    }),
  };
}

function relationalTask(
  goalType: DenisGoal["type"],
  reason: string,
  schema: InterpretationSchema = "relational_social",
  budget?: Partial<InterpretationEvidenceBudget>,
  contextBudget?: Pick<
    InterpretationEvidenceBudget,
    "contextTokenBudget" | "turnComplexity"
  >
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
      ...contextBudget,
      ...budget,
    }),
  };
}

function withTopicDirective(
  task: InterpretationTask,
  budgetInput?: InterpretationBudgetInput
): InterpretationTask {
  const topicBlock = buildTopicInterpretationDirective({
    graph: budgetInput?.conversationGraph,
    guestMessage: budgetInput?.guestMessage ?? "",
  });
  if (!topicBlock) return task;
  return {
    ...task,
    directiveBlock: `${task.directiveBlock}\n${topicBlock}`,
  };
}

/**
 * Table OS L3 — topGoal + beliefs → schema-driven perceive task (ARCH-7 / C12).
 * Returns null when no top goal — caller falls back to legacy regex perceive routing.
 */
export function buildInterpretationTask(
  topGoal: DenisGoal | null,
  beliefs: BeliefGraph,
  budgetInput?: InterpretationBudgetInput
): InterpretationTask | null {
  if (!topGoal) return null;

  const contextBudget = resolveTaskContextBudget(beliefs, budgetInput);

  switch (topGoal.type) {
    case "RECONCILE_CART":
    case "INFORM_STATUS":
      return null;

    case "CLARIFY_SLOT":
      return withTopicDirective(
        transactionalTask(
          topGoal.type,
          "goal.clarify_slot.interpret",
          contextBudget
        ),
        budgetInput
      );

    case "COMPLETE_ROUND": {
      const transactional = hasCommercePressure(beliefs);
      if (transactional) {
        return withTopicDirective(
          transactionalTask(
            topGoal.type,
            "goal.complete_round.transactional",
            contextBudget
          ),
          budgetInput
        );
      }
      return withTopicDirective(
        relationalTask(
          topGoal.type,
          "goal.complete_round.social",
          "relational_social",
          undefined,
          contextBudget
        ),
        budgetInput
      );
    }

    case "UPSELL_ONCE": {
      const receptiveness = getBeliefValue<string>(
        beliefs,
        CORE_BELIEF_KEYS.mentalReceptiveness
      );
      if (receptiveness === "closed" || receptiveness === "polite_decline") {
        return null;
      }

      const frustration = getBeliefValue<string>(
        beliefs,
        CORE_BELIEF_KEYS.mentalFrustration
      );
      if (frustration === "high") return null;

      const affinity =
        getBeliefValue<string>(beliefs, CORE_BELIEF_KEYS.mentalPriceAffinity) ??
        "unknown";
      const reason =
        affinity === "budget"
          ? "goal.upsell_once.budget"
          : affinity === "premium"
            ? "goal.upsell_once.premium"
            : "goal.upsell_once.relational";

      return withTopicDirective(
        relationalTask(topGoal.type, reason, "upsell_nudge", {
          includeCatalogRag: true,
          omitFullMenuWhenNoRag: true,
        }, contextBudget),
        budgetInput
      );
    }

    case "GUEST_SEATED": {
      const transactional =
        hasCommercePressure(beliefs) ||
        getBeliefValue<ConversationMode>(
          beliefs,
          CORE_BELIEF_KEYS.conversationMode
        ) === "ordering";
      if (transactional) {
        return withTopicDirective(
          transactionalTask(
            topGoal.type,
            "goal.guest_seated.ordering",
            contextBudget
          ),
          budgetInput
        );
      }
      return withTopicDirective(
        relationalTask(
          topGoal.type,
          "goal.guest_seated.social",
          undefined,
          undefined,
          contextBudget
        ),
        budgetInput
      );
    }

    case "HANDOFF":
      return withTopicDirective(
        transactionalTask(
          topGoal.type,
          "goal.handoff.transactional",
          contextBudget
        ),
        budgetInput
      );

    case "CLOSE_VISIT":
      return withTopicDirective(
        relationalTask(
          topGoal.type,
          "goal.close_visit.social",
          undefined,
          undefined,
          contextBudget
        ),
        budgetInput
      );

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
