import type {
  DenisGoal,
  GoalDerivationContext,
  GoalStack,
} from "@/lib/denis/kernel/goal-types";

function sortGoals(goals: DenisGoal[]): GoalStack {
  return [...goals].sort((a, b) => b.priority - a.priority);
}

/** Derive goal stack from flow node + session context (ADR-004). */
export function deriveGoalStack(ctx: GoalDerivationContext): GoalStack {
  const goals: DenisGoal[] = [];

  if (ctx.cartConflict) {
    goals.push({ type: "RECONCILE_CART", priority: 95 });
  }

  if (ctx.pendingSlot) {
    goals.push({
      type: "CLARIFY_SLOT",
      slot: ctx.pendingSlot,
      priority: 80,
    });
  }

  switch (ctx.flowNodeId) {
    case "welcome":
      goals.push({ type: "OPEN_TABLE", priority: 10 });
      break;
    case "collect":
      goals.push({ type: "COMPLETE_ROUND", priority: 90 });
      break;
    case "upsell_food":
      if (!ctx.skipUpsell && !ctx.foodUpsellAsked) {
        goals.push({ type: "UPSELL_ONCE", category: "food", priority: 40 });
      }
      goals.push({ type: "COMPLETE_ROUND", priority: 90 });
      break;
    case "recap":
      goals.push({ type: "COMPLETE_ROUND", priority: 90 });
      break;
    case "submit":
      goals.push({ type: "COMPLETE_ROUND", priority: 90 });
      break;
    case "post_submit":
      goals.push({ type: "OPEN_TABLE", priority: 10 });
      break;
    case "status":
      if (ctx.hasOpenOrders) {
        goals.push({ type: "INFORM_STATUS", orderId: "*", priority: 50 });
      }
      break;
    case "browse":
      goals.push({ type: "OPEN_TABLE", priority: 10 });
      break;
    default:
      goals.push({ type: "COMPLETE_ROUND", priority: 90 });
  }

  if (ctx.lastIntent === "HANDOFF_WAITER") {
    goals.push({ type: "HANDOFF", kind: "waiter", priority: 96 });
  }
  if (ctx.lastIntent === "HANDOFF_PAY") {
    if (!ctx.handoffPaymentMethod) {
      goals.push({
        type: "CLARIFY_SLOT",
        slot: { kind: "payment_method" },
        priority: 80,
      });
    }
    goals.push({ type: "HANDOFF", kind: "payment", priority: 96 });
  }

  return sortGoals(goals);
}

export function topGoal(stack: GoalStack): DenisGoal | null {
  return stack[0] ?? null;
}
