import { FlowSignalSchema } from "@/lib/denis/platform/flow-types";
import type {
  FlowDefinition,
  FlowGuardContext,
  FlowNodePlan,
  FlowNodeId,
  FlowSignal,
  FlowTransitionResult,
} from "@/lib/denis/platform/flow-types";

function evaluateGuard(
  guard: string | undefined,
  ctx: FlowGuardContext
): boolean {
  if (!guard) return true;
  if (guard === "config.upsell.foodAfterDrinks") {
    return ctx.foodAfterDrinksEnabled && !ctx.skipUpsell;
  }
  return true;
}

function skipGuardedNode(
  flow: FlowDefinition,
  targetNodeId: FlowNodeId,
  ctx: FlowGuardContext
): { nodeId: FlowNodeId; skipped: boolean } {
  const node = flow.nodes[targetNodeId];
  if (!node) {
    return { nodeId: targetNodeId, skipped: false };
  }
  if (evaluateGuard(node.guard, ctx)) {
    return { nodeId: targetNodeId, skipped: false };
  }

  if (targetNodeId === "upsell_food") {
    return { nodeId: "recap", skipped: true };
  }

  return { nodeId: targetNodeId, skipped: true };
}

/** Resolve next flow node from current node + signal. */
export function resolveFlowTransition(
  flow: FlowDefinition,
  currentNodeId: FlowNodeId,
  signal: FlowSignal,
  ctx: FlowGuardContext
): FlowTransitionResult {
  const current = flow.nodes[currentNodeId];
  const fallbackNodeId = currentNodeId;

  if (!current) {
    return {
      fromNodeId: currentNodeId,
      toNodeId: flow.entry,
      signal,
      skippedGuard: false,
    };
  }

  const rawTarget = current.on?.[signal];
  if (!rawTarget) {
    return {
      fromNodeId: currentNodeId,
      toNodeId: fallbackNodeId,
      signal,
      skippedGuard: false,
    };
  }

  const { nodeId, skipped } = skipGuardedNode(flow, rawTarget, ctx);

  return {
    fromNodeId: currentNodeId,
    toNodeId: nodeId,
    signal,
    skippedGuard: skipped,
  };
}

export function describeFlowNode(
  flow: FlowDefinition,
  nodeId: FlowNodeId
): FlowNodePlan {
  const node = flow.nodes[nodeId];
  return {
    nodeId,
    skills: node?.skills ?? [],
    narrateTemplate: node?.narrate ?? null,
    guard: node?.guard ?? null,
  };
}

/** Infer flow signals from cart state (after cart mutation). */
export function cartFlowSignals(input: {
  cartItemCount: number;
  drinksOnly: boolean;
  hasFood: boolean;
}): FlowSignal[] {
  const signals: FlowSignal[] = [];
  if (input.cartItemCount === 0) return signals;
  if (input.drinksOnly) signals.push("DRAFT_DRINKS_ONLY");
  if (input.hasFood) signals.push("DRAFT_HAS_FOOD");
  return signals;
}

/** Map guest intent string to flow signal. */
export function intentToFlowSignal(intent: string): FlowSignal {
  const normalized = intent.toUpperCase();
  const parsed = FlowSignalSchema.safeParse(normalized);
  if (parsed.success) {
    return parsed.data;
  }
  return "UNKNOWN";
}
