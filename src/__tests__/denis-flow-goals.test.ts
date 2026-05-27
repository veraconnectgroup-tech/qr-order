import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { analyzeCartSnapshot } from "@/lib/denis/kernel/cart-signals";
import { deriveGoalStack, topGoal } from "@/lib/denis/kernel/goal-stack";
import { planTurn } from "@/lib/denis/kernel/plan-turn";
import { SKILL_REGISTRY } from "@/lib/denis/kernel/skill-registry";
import {
  intentToFlowSignal,
  resolveFlowTransition,
} from "@/lib/denis/platform/flow-engine";
import { foldFlowProjection } from "@/lib/denis/platform/fold-flow";
import { getFlowPreset } from "@/lib/denis/platform/load-flow-preset";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const config = CONCIERGE_PLATFORM_DEFAULTS;
const flow = getFlowPreset("denis_short");

describe("flow engine M3", () => {
  it("loads denis_short preset", () => {
    expect(flow.id).toBe("denis_short");
    expect(flow.entry).toBe("welcome");
  });

  it("transitions welcome + ORDER → collect", () => {
    const result = resolveFlowTransition(flow, "welcome", "ORDER", {
      foodAfterDrinksEnabled: true,
      foodUpsellAsked: false,
      cartItemCount: 0,
      drinksOnly: false,
      hasFood: false,
    });
    expect(result.toNodeId).toBe("collect");
  });

  it("skips upsell_food when config guard off", () => {
    const result = resolveFlowTransition(flow, "collect", "DRAFT_DRINKS_ONLY", {
      foodAfterDrinksEnabled: false,
      foodUpsellAsked: false,
      cartItemCount: 1,
      drinksOnly: true,
      hasFood: false,
    });
    expect(result.toNodeId).toBe("recap");
    expect(result.skippedGuard).toBe(true);
  });

  it("enters upsell_food when drinks only and guard on", () => {
    const result = resolveFlowTransition(flow, "collect", "DRAFT_DRINKS_ONLY", {
      foodAfterDrinksEnabled: true,
      foodUpsellAsked: false,
      cartItemCount: 1,
      drinksOnly: true,
      hasFood: false,
    });
    expect(result.toNodeId).toBe("upsell_food");
  });

  it("folds flow.transitioned events", () => {
    const events: DenisTimelineRow[] = [
      {
        id: "1",
        ai_session_id: "s1",
        seq: 1,
        event_type: "flow.transitioned",
        payload: { from: "welcome", to: "collect", signal: "ORDER" },
        trace_id: null,
        context_hash: null,
        created_at: "2026-05-27T12:00:00.000Z",
      },
    ];
    expect(foldFlowProjection(events).currentNodeId).toBe("collect");
  });
});

describe("goal stack M3", () => {
  it("prioritizes RECONCILE_CART over COMPLETE_ROUND", () => {
    const stack = deriveGoalStack({
      flowNodeId: "recap",
      pendingSlot: null,
      cartConflict: true,
      foodUpsellAsked: true,
      hasOpenOrders: false,
      lastIntent: null,
    });
    expect(topGoal(stack)?.type).toBe("RECONCILE_CART");
  });

  it("assigns UPSELL_ONCE on upsell_food node", () => {
    const stack = deriveGoalStack({
      flowNodeId: "upsell_food",
      pendingSlot: null,
      cartConflict: false,
      foodUpsellAsked: false,
      hasOpenOrders: false,
      lastIntent: null,
    });
    expect(stack.some((g) => g.type === "UPSELL_ONCE")).toBe(true);
  });
});

describe("planTurn M3", () => {
  it("plans recap skills on DONE from collect", () => {
    const plan = planTurn({
      config,
      flowNodeId: "collect",
      intent: "DONE",
      cartItems: [{ menuSection: "drinks" }],
    });
    expect(plan.transition.toNodeId).toBe("recap");
    expect(plan.skills.some((s) => s.id === "cart.recap")).toBe(true);
    expect(plan.topGoal?.type).toBe("COMPLETE_ROUND");
  });

  it("maps DONE intent to flow signal", () => {
    expect(intentToFlowSignal("DONE")).toBe("DONE");
  });
});

describe("skill registry ADR-006", () => {
  it("assigns R5 to order.submit", () => {
    expect(SKILL_REGISTRY["order.submit"].riskClass).toBe("R5");
  });

  it("assigns R2 to cart mutations", () => {
    expect(SKILL_REGISTRY["cart.add_or_clarify"].riskClass).toBe("R2");
  });
});

describe("cart signals", () => {
  it("detects drinks-only cart", () => {
    const snapshot = analyzeCartSnapshot([{ menuSection: "drinks" }]);
    expect(snapshot.drinksOnly).toBe(true);
    expect(snapshot.hasFood).toBe(false);
  });
});
