import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import { topGoal } from "@/lib/denis/kernel/goal-stack";
import { resolveFlowTransition } from "@/lib/denis/platform/flow-engine";
import { getFlowPreset } from "@/lib/denis/platform/load-flow-preset";
import { buildNarrationFacts } from "@/lib/denis/runtime/narrate/build-narration-facts";
import {
  deriveOpsPlannerEffects,
  unavailableProductNamesInDraft,
} from "@/lib/denis/venue/ops/planner-effects";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const rushOps: VenueOpsBeliefs = {
  operatingMode: "rush",
  kdsStress: "normal",
  acceptingOrders: true,
  unavailableProductIds: [],
  staffHint: null,
};

describe("ops planner effects M13", () => {
  it("skips upsell in rush mode", () => {
    const effects = deriveOpsPlannerEffects(rushOps, CONCIERGE_PLATFORM_DEFAULTS);
    expect(effects.skipUpsell).toBe(true);
    expect(effects.shortenReplies).toBe(true);
  });

  it("skips upsell when KDS stress is high", () => {
    const effects = deriveOpsPlannerEffects(
      { ...rushOps, operatingMode: "normal", kdsStress: "high" },
      CONCIERGE_PLATFORM_DEFAULTS
    );
    expect(effects.skipUpsell).toBe(true);
  });

  it("exposes guest-safe staff hint", () => {
    const effects = deriveOpsPlannerEffects(
      {
        ...rushOps,
        operatingMode: "normal",
        staffHint: {
          text: "VIP — comp dessert if asked",
          visibility: "guest_safe",
          expiresAt: new Date().toISOString(),
        },
      },
      CONCIERGE_PLATFORM_DEFAULTS
    );
    expect(effects.guestSafeStaffHint).toContain("VIP");
  });
});

describe("ops flow + goals M13", () => {
  it("skips upsell_food node when rush", () => {
    const flow = getFlowPreset("denis_short");
    const transition = resolveFlowTransition(flow, "collect", "DRAFT_DRINKS_ONLY", {
      foodAfterDrinksEnabled: true,
      foodUpsellAsked: false,
      cartItemCount: 1,
      drinksOnly: true,
      hasFood: false,
      skipUpsell: true,
    });
    expect(transition.toNodeId).toBe("recap");
    expect(transition.skippedGuard).toBe(true);
  });

  it("does not add UPSELL_ONCE goal when skipUpsell", () => {
    const result = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "",
      flowNodeId: "upsell_food",
      cartState: emptyCartState(),
      skipUpsell: true,
    });
    expect(topGoal(result.plan.goals)?.type).not.toBe("UPSELL_ONCE");
  });
});

describe("ops narration facts M13", () => {
  it("flags unavailable products in draft", () => {
    const reflexTurn = planTurnWithReflex({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      message: "cola",
      flowNodeId: "collect",
      cartState: {
        ...emptyCartState(),
        draft: {
          cartRevision: 1,
          items: [
            {
              productId: "p-unavail",
              productName: "Cola Zero",
              quantity: 1,
              serveSize: null,
              modifierIds: [],
              notes: "",
              lineTotal: 4,
              menuSection: "drinks",
            },
          ],
        },
      },
    });

    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "sr",
      reflexTurn,
      venueOps: {
        ...rushOps,
        operatingMode: "normal",
        unavailableProductIds: ["p-unavail"],
      },
      opsEffects: deriveOpsPlannerEffects(rushOps, CONCIERGE_PLATFORM_DEFAULTS),
    });

    expect(facts.committed.blockedReason).toContain("Cola Zero");
  });

  it("detects unavailable names from draft lines", () => {
    const names = unavailableProductNamesInDraft(
      [{ productId: "p1", productName: "Burger" }],
      ["p1"]
    );
    expect(names).toEqual(["Burger"]);
  });
});
