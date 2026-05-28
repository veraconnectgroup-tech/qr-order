import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { analyzeCartSnapshot } from "@/lib/denis/kernel/cart-signals";
import { deriveGoalStack, topGoal } from "@/lib/denis/kernel/goal-stack";
import type { GoalDerivationContext } from "@/lib/denis/kernel/goal-types";
import { skillsForNode } from "@/lib/denis/kernel/skill-registry";
import {
  cartFlowSignals,
  describeFlowNode,
  intentToFlowSignal,
  resolveFlowTransition,
} from "@/lib/denis/platform/flow-engine";
import { getFlowPreset } from "@/lib/denis/platform/load-flow-preset";
import type {
  FlowGuardContext,
  FlowNodeId,
  FlowSignal,
} from "@/lib/denis/platform/flow-types";
import type { SkillDefinition } from "@/lib/denis/kernel/skill-registry";
import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import type { FlowTransitionResult } from "@/lib/denis/platform/flow-types";

export type PlanTurnInput = {
  config: ConciergeConfig;
  flowNodeId: FlowNodeId;
  intent: string;
  cartItems: Array<{ menuSection?: string | null }>;
  foodUpsellAsked?: boolean;
  pendingSlot?: GoalDerivationContext["pendingSlot"];
  cartConflict?: boolean;
  hasOpenOrders?: boolean;
  submitOutcome?: "SUCCESS" | "FAIL" | null;
  skipUpsell?: boolean;
  handoffPaymentMethod?: string | null;
};

export type PlannedSkill = SkillDefinition;

export type PlanTurnResult = {
  transition: FlowTransitionResult;
  flowNode: ReturnType<typeof describeFlowNode>;
  goals: DenisGoal[];
  topGoal: DenisGoal | null;
  skills: PlannedSkill[];
  primarySignal: FlowSignal;
};

function buildGuardContext(
  config: ConciergeConfig,
  input: PlanTurnInput
): FlowGuardContext {
  const cart = analyzeCartSnapshot(input.cartItems);
  return {
    foodAfterDrinksEnabled: config.upsell.foodAfterDrinks,
    foodUpsellAsked: input.foodUpsellAsked ?? false,
    cartItemCount: cart.itemCount,
    drinksOnly: cart.drinksOnly,
    hasFood: cart.hasFood,
    skipUpsell: input.skipUpsell ?? false,
  };
}

function resolvePrimarySignal(input: PlanTurnInput): FlowSignal {
  if (input.submitOutcome === "SUCCESS") return "SUCCESS";
  if (input.submitOutcome === "FAIL") return "FAIL";

  const intentSignal = intentToFlowSignal(input.intent);
  if (intentSignal !== "UNKNOWN") {
    return intentSignal;
  }

  const cart = analyzeCartSnapshot(input.cartItems);
  const cartSignals = cartFlowSignals({
    cartItemCount: cart.itemCount,
    drinksOnly: cart.drinksOnly,
    hasFood: cart.hasFood,
  });
  return cartSignals[0] ?? "UNKNOWN";
}

/** M3 planner — Flow DSL + goal stack + skill registry (no LLM). */
export function planTurn(input: PlanTurnInput): PlanTurnResult {
  const flow = getFlowPreset(input.config.ordering.flow);
  const guardContext = buildGuardContext(input.config, input);
  const primarySignal = resolvePrimarySignal(input);

  const transition = resolveFlowTransition(
    flow,
    input.flowNodeId,
    primarySignal,
    guardContext
  );

  const flowNode = describeFlowNode(flow, transition.toNodeId);
  const goals = deriveGoalStack({
    flowNodeId: transition.toNodeId,
    pendingSlot: input.pendingSlot ?? null,
    cartConflict: input.cartConflict ?? false,
    foodUpsellAsked: input.foodUpsellAsked ?? false,
    hasOpenOrders: input.hasOpenOrders ?? false,
    lastIntent: input.intent,
    handoffPaymentMethod: input.handoffPaymentMethod ?? null,
    skipUpsell: input.skipUpsell ?? false,
  });

  return {
    transition,
    flowNode,
    goals,
    topGoal: topGoal(goals),
    skills: skillsForNode(flowNode.skills),
    primarySignal,
  };
}
