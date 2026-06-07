import { describe, expect, it } from "vitest";

import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";

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
});
