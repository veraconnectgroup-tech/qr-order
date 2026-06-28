import { describe, expect, it } from "vitest";

import { evaluateProactivePolicyForKind } from "@/lib/denis/cognition/proactive/apply-proactive-policy";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import {
  belief,
  beliefGraph,
  CORE_BELIEF_KEYS,
  decideTurnPlan,
  buildInterpretationTask,
} from "@/lib/denis/cognition/tde";
import { planTurnWithReflex as reflexPlan } from "@/lib/denis/kernel/reflex-plan";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";

const NOW = Date.parse("2026-06-07T20:00:00.000Z");

function mentalWithNeed(
  need: GuestMentalModel["predictedNeed"]
): GuestMentalModel {
  return {
    ...emptyGuestMentalModel(NOW),
    predictedNeed: need,
    affect: {
      frustration: { level: need === "needs_attention" ? "high" : "none", signals: [] },
      sentiment: { score: 0, lastSignals: [] },
    },
  };
}

describe("rankProactiveCandidates", () => {
  it("prioritizes attention_handoff over upsells when needs_attention", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      mentalModel: {
        ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
        mode: "enforce" as const,
      },
    };

    const ranked = rankProactiveCandidates({
      config,
      orders: [],
      mental: mentalWithNeed("needs_attention"),
      payload: {
        sessionPhase: "waiting",
        dismissedNudgeKeys: [],
        guestMessageCount: 3,
        browseMinutes: 10,
        idleMinutes: 15,
      },
      messages: {
        browse: "browse",
        dessert: "dessert",
        slowKitchen: "slow",
        guestWelcome: "welcome",
        browseFollowUp: "follow up",
        billPrompt: "bill",
        orderDelay: "delay",
        popularityPair: "pair",
      },
      now: NOW,
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.nudge.kind).toBe("attention_handoff");
  });

  it("prioritizes bill_prompt over dessert when wants_bill", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      mentalModel: {
        ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
        mode: "enforce" as const,
      },
    };

    const mental: GuestMentalModel = {
      ...emptyGuestMentalModel(NOW),
      mealStage: "post_meal",
      predictedNeed: "wants_bill",
      intent: "finishing",
      receptiveness: "open",
      nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
    };

    const ranked = rankProactiveCandidates({
      config,
      orders: [
        {
          id: "ord-1",
          status: "delivered",
          created_at: new Date(NOW - 45 * 60_000).toISOString(),
          delivered_at: new Date(NOW - 40 * 60_000).toISOString(),
          order_items: [
            {
              product_id: null,
              product_name: "Steak",
              unit_price: 0,
              quantity: 1,
              menu_section: "food",
            },
          ],
        },
      ],
      mental,
      payload: {
        sessionPhase: "settling",
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
        idleMinutes: 20,
      },
      messages: {
        browse: "browse",
        dessert: "dessert",
        slowKitchen: "slow",
        guestWelcome: "welcome",
        browseFollowUp: "follow up",
        billPrompt: "bill",
        orderDelay: "delay",
        popularityPair: "pair",
      },
      now: NOW,
    });

    const kinds = ranked.map((row) => row.nudge.kind);
    expect(kinds).toContain("bill_prompt");
    if (kinds.includes("dessert_nudge")) {
      expect(kinds.indexOf("bill_prompt")).toBeLessThan(
        kinds.indexOf("dessert_nudge")
      );
    } else {
      expect(ranked[0]?.nudge.kind).toBe("bill_prompt");
    }
  });

  it("blocks popularity_pair when price affinity is budget", () => {
    const mental: GuestMentalModel = {
      ...emptyGuestMentalModel(NOW),
      priceAffinity: "budget",
      receptiveness: "open",
      nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
    };

    const verdict = evaluateProactivePolicyForKind({
      mental,
      kind: "popularity_pair",
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });

    expect(verdict.allow).toBe(false);
    expect(verdict.reason).toBe("gmm.price_affinity_mismatch");
  });

  const deliveredFoodOrder = {
    id: "ord-dessert",
    status: "delivered" as const,
    created_at: new Date(NOW - 20 * 60_000).toISOString(),
    delivered_at: new Date(NOW - 25 * 60_000).toISOString(),
    order_items: [
      {
        product_id: null,
        product_name: "Steak",
        unit_price: 0,
        quantity: 1,
        menu_section: "food" as const,
      },
    ],
  };

  const rankMessages = {
    browse: "browse",
    dessert: "dessert",
    slowKitchen: "slow",
    guestWelcome: "welcome",
    browseFollowUp: "follow up",
    billPrompt: "bill",
    orderDelay: "delay",
    popularityPair: "pair",
  };

  it("T4 enforce: dessert uses mealStage, not minute trigger alone", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      mentalModel: {
        ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
        mode: "enforce" as const,
      },
    };

    const withoutWindow = rankProactiveCandidates({
      config,
      orders: [deliveredFoodOrder],
      mental: {
        ...emptyGuestMentalModel(NOW),
        mealStage: "main",
        predictedNeed: "ready_to_order",
        receptiveness: "open",
        nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
      },
      payload: {
        sessionPhase: "settling",
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now: NOW,
    });

    expect(withoutWindow.some((row) => row.nudge.kind === "dessert_nudge")).toBe(
      false
    );

    const withWindow = rankProactiveCandidates({
      config,
      orders: [deliveredFoodOrder],
      mental: {
        ...emptyGuestMentalModel(NOW),
        mealStage: "dessert_window",
        predictedNeed: "wants_dessert",
        receptiveness: "open",
        nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
      },
      payload: {
        sessionPhase: "settling",
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now: NOW,
    });

    expect(withWindow.some((row) => row.nudge.kind === "dessert_nudge")).toBe(
      true
    );
  });

  it("legacy mode: minute trigger still ranks dessert without dessert_window", () => {
    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [deliveredFoodOrder],
      mental: emptyGuestMentalModel(NOW),
      payload: {
        sessionPhase: "settling",
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now: NOW,
    });

    expect(ranked.some((row) => row.nudge.kind === "dessert_nudge")).toBe(true);
  });
});

describe("decideTurnPlan — mental price affinity", () => {
  const config = CONCIERGE_PLATFORM_DEFAULTS;

  it("routes vague recommend to budget-scoped reason", () => {
    const beliefs = beliefGraph([
      belief(CORE_BELIEF_KEYS.conversationMode, "banter"),
      belief(CORE_BELIEF_KEYS.mentalPriceAffinity, "budget"),
    ]);
    const reflex = reflexPlan({
      config,
      message: "sta da jedem",
      flowNodeId: "browse",
      cartState: emptyCartState(),
      skipUpsell: false,
    });

    const plan = decideTurnPlan({
      beliefs,
      reflex: { ...reflex, plan: { ...reflex.plan, topGoal: null } },
      message: "sta da jedem",
    });

    expect(plan.kind).toBe("relational_perceive");
    expect(plan.reason).toBe("vague_recommend.budget");
  });

  it("scopes upsell goal to premium price affinity", () => {
    const beliefs = beliefGraph([
      belief(CORE_BELIEF_KEYS.mentalPriceAffinity, "premium"),
      belief(CORE_BELIEF_KEYS.mentalReceptiveness, "open"),
      belief(CORE_BELIEF_KEYS.mentalFrustration, "none"),
    ]);

    const task = buildInterpretationTask(
      { type: "UPSELL_ONCE", category: "food", priority: 40 },
      beliefs
    );

    expect(task?.reason).toBe("goal.upsell_once.premium");
  });
});
