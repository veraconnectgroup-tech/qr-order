import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { topGoal } from "@/lib/denis/kernel/goal-stack";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { DENIS_EVAL_SCENARIOS } from "@/lib/denis/eval/fixtures/scenarios";
import type {
  DenisEvalScenario,
  ScenarioRunResult,
} from "@/lib/denis/eval/types";

function cartDraftFromLines(
  items: DenisEvalScenario["aiCartItems"]
) {
  return {
    cartRevision: 1,
    items: items ?? [],
  };
}

/** Run one fixture through kernel planner (no LLM, no DB). */
export function runDenisScenario(
  scenario: DenisEvalScenario
): ScenarioRunResult {
  const config = CONCIERGE_PLATFORM_DEFAULTS;
  const errors: string[] = [];

  const reflexTurn = planTurnWithReflex({
    config,
    message: scenario.message,
    flowNodeId: scenario.flowNodeId ?? "welcome",
    cartState: {
      ...emptyCartState(),
      draft: cartDraftFromLines(scenario.aiCartItems),
    },
    manualCartDraft: cartDraftFromLines(scenario.manualCartItems),
    foodUpsellAsked: scenario.foodUpsellAsked ?? false,
  });

  const actualTopGoal = reflexTurn.plan.topGoal?.type ?? null;
  const actual = {
    topGoal: actualTopGoal,
    hasConflict: reflexTurn.conflict?.hasConflict ?? false,
    flowNodeId: reflexTurn.plan.transition.toNodeId,
    skillIds: reflexTurn.plan.skills.map((skill) => skill.id),
    usedT0: reflexTurn.usedT0,
    intent: reflexTurn.reflex?.intent ?? null,
  };

  const { expect: expected } = scenario;

  if (expected.topGoal && actualTopGoal !== expected.topGoal) {
    errors.push(`topGoal: expected ${expected.topGoal}, got ${actualTopGoal}`);
  }

  if (
    expected.hasConflict !== undefined &&
    actual.hasConflict !== expected.hasConflict
  ) {
    errors.push(
      `hasConflict: expected ${expected.hasConflict}, got ${actual.hasConflict}`
    );
  }

  if (expected.flowNodeId && actual.flowNodeId !== expected.flowNodeId) {
    errors.push(
      `flowNodeId: expected ${expected.flowNodeId}, got ${actual.flowNodeId}`
    );
  }

  if (expected.usedT0 !== undefined && actual.usedT0 !== expected.usedT0) {
    errors.push(`usedT0: expected ${expected.usedT0}, got ${actual.usedT0}`);
  }

  if (expected.intent && actual.intent !== expected.intent) {
    errors.push(`intent: expected ${expected.intent}, got ${actual.intent}`);
  }

  if (expected.skillIds) {
    for (const skillId of expected.skillIds) {
      if (!actual.skillIds.some((id) => id === skillId)) {
        errors.push(`missing skill: ${skillId}`);
      }
    }
  }

  return {
    scenarioId: scenario.id,
    passed: errors.length === 0,
    errors,
    actual,
  };
}

export function runDenisScenarioById(id: string): ScenarioRunResult | null {
  const scenario = DENIS_EVAL_SCENARIOS.find((row) => row.id === id);
  if (!scenario) return null;
  return runDenisScenario(scenario);
}
