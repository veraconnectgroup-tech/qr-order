import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import { predictNextAction } from "@/lib/denis/cognition/mental-model/predict-next-action";
import { predictMealTrajectory } from "@/lib/denis/cognition/mental-model/predict-trajectory";
import { predictGuestSpend } from "@/lib/denis/cognition/mental-model/predict-spend";
import { predictGuestSessionDuration } from "@/lib/denis/intelligence/load-table-turnover-priors";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";

const NOW = Date.parse("2026-06-07T12:30:00.000Z");

function burgerFriesBrowse() {
  return {
    ...emptyBrowseProfile(),
    browsedFood: true,
    eventCount: 2,
    viewedProducts: [
      {
        productId: "burger-1",
        productName: "Classic Burger",
        categoryPath: ["food"],
        viewCount: 3,
        totalDwellMs: 120_000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "interested" as const,
        unitPrice: 14,
      },
      {
        productId: "fries-1",
        productName: "Crispy Fries",
        categoryPath: ["food"],
        viewCount: 1,
        totalDwellMs: 15_000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
        unitPrice: 5,
      },
    ],
  };
}

describe("predictNextAction", () => {
  it("browse burgers 2min then fries → P(order bundle)=0.85", () => {
    const result = predictNextAction({
      browse: burgerFriesBrowse(),
      cartLineCount: 0,
      intent: "comparing",
    });

    expect(result.action).toBe("order_bundle");
    expect(result.probability).toBe(0.85);
    expect(result.preloadProducts.map((p) => p.productName)).toEqual([
      "Classic Burger",
      "Crispy Fries",
    ]);
  });

  it("5 items browsed, none added → P(needs help)=0.7", () => {
    const browse = {
      ...emptyBrowseProfile(),
      eventCount: 5,
      viewedProducts: Array.from({ length: 5 }, (_, index) => ({
        productId: `p-${index}`,
        productName: `Item ${index}`,
        categoryPath: ["food"],
        viewCount: 1,
        totalDwellMs: 4000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
      })),
    };

    const result = predictNextAction({
      browse,
      cartLineCount: 0,
      intent: "exploring",
    });

    expect(result.action).toBe("needs_help");
    expect(result.probability).toBe(0.7);
    expect(result.triggerProactiveHelp).toBe(true);
  });
});

describe("predictGuestSessionDuration", () => {
  it("solo weekday lunch → ~30min efficient mode", () => {
    const result = predictGuestSessionDuration({
      partySize: 1,
      localHour: 12,
      dayOfWeek: 2,
    });

    expect(result.predictedMinutes).toBe(30);
    expect(result.mode).toBe("efficient");
  });

  it("couple Friday 20:00 → ~90min relaxed mode", () => {
    const result = predictGuestSessionDuration({
      partySize: 2,
      localHour: 20,
      dayOfWeek: 5,
    });

    expect(result.predictedMinutes).toBe(90);
    expect(result.mode).toBe("relaxed");
  });
});

describe("predictGuestSpend", () => {
  it("low spend browse → value upsell tier", () => {
    const result = predictGuestSpend({
      browse: {
        ...emptyBrowseProfile(),
        eventCount: 3,
        priceBrowseStats: {
          viewedPriceCount: 2,
          avgViewedPrice: 8,
          maxViewedPrice: 10,
          onlyBudgetItems: true,
          onlyPremiumItems: false,
        },
      },
      partySize: 1,
      localHour: 12,
      sessionDurationMinutes: 20,
      priceAffinity: "unknown",
    });

    expect(result.tier).toBe("low");
    expect(result.upsellTier).toBe("value");
  });

  it("premium browse evening → premium upsell tier", () => {
    const result = predictGuestSpend({
      browse: {
        ...emptyBrowseProfile(),
        eventCount: 4,
        priceBrowseStats: {
          viewedPriceCount: 3,
          avgViewedPrice: 48,
          maxViewedPrice: 62,
          onlyBudgetItems: false,
          onlyPremiumItems: true,
        },
      },
      partySize: 2,
      localHour: 20,
      sessionDurationMinutes: 40,
      priceAffinity: "unknown",
    });

    expect(result.tier).toBe("high");
    expect(result.upsellTier).toBe("premium");
  });
});

describe("predictMealTrajectory", () => {
  it("za dvoje + browsing mains → 2 mains, 2 drinks, dessert maybe", () => {
    const result = predictMealTrajectory({
      browse: {
        ...emptyBrowseProfile(),
        browsedFood: true,
        dominantMenuSection: "food",
        browsedDesserts: true,
      },
      partySize: 1,
      mealStage: "pre_order",
      intent: "exploring",
      lastGuestText: "Sto za dvoje, hvala",
    });

    expect(result.partySize).toBe(2);
    expect(result.predictedMains).toBe(2);
    expect(result.predictedDrinks).toBe(2);
    expect(result.predictedDessert).toBe(true);
    expect(result.plannedSteps).toEqual([
      "greet",
      "drinks",
      "mains",
      "dessert",
      "bill",
    ]);
  });
});

describe("foldGuestMentalModel L2 wiring", () => {
  it("folds predictions and adjusts pace for solo lunch", () => {
    const mental = foldGuestMentalModel({
      timeline: [],
      browse: burgerFriesBrowse(),
      conversation: emptyConversationModel(),
      commerce: { orders: [], cart: { ai: emptyCartState(), visibleLines: [] } },
      session: { billSettled: false },
      conversationMeta: { flowNodeId: "explore", dismissedNudges: [] },
      phase: "browsing",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now: NOW,
      localHour: 12,
      dayOfWeek: 2,
    });

    expect(mental.predictions.nextAction.probability).toBe(0.85);
    expect(mental.pace).toBe("rushed");
    expect(mental.predictions.duration.mode).toBe("efficient");
  });

  it("browse paralysis triggers needs_help via fold", () => {
    const browse = {
      ...emptyBrowseProfile(),
      eventCount: 5,
      viewedProducts: Array.from({ length: 5 }, (_, index) => ({
        productId: `p-${index}`,
        productName: `Item ${index}`,
        categoryPath: ["food"],
        viewCount: 1,
        totalDwellMs: 4000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
      })),
    };

    const mental = foldGuestMentalModel({
      timeline: [],
      browse,
      conversation: emptyConversationModel(),
      commerce: { orders: [], cart: { ai: emptyCartState(), visibleLines: [] } },
      session: { billSettled: false },
      conversationMeta: { flowNodeId: "explore", dismissedNudges: [] },
      phase: "browsing",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now: NOW,
    });

    expect(mental.predictions.nextAction.action).toBe("needs_help");
    expect(mental.predictedNeed).toBe("needs_help_choosing");
  });

  it("date night fold → relaxed pace", () => {
    const mental = foldGuestMentalModel({
      timeline: [],
      browse: {
        ...emptyBrowseProfile(),
        browsedFood: true,
        browsedDrinks: true,
      },
      conversation: {
        ...emptyConversationModel(),
        thread: {
          ...emptyConversationModel().thread,
          lastGuestText: "Sto za dvoje molim",
        },
      },
      commerce: { orders: [], cart: { ai: emptyCartState(), visibleLines: [] } },
      party: {
        tableSessionId: "s1",
        partyMode: "shared_cart",
        sharedAiSessionId: null,
        devices: [],
        activeDeviceCount: 2,
        currentDeviceFingerprint: null,
        isCurrentDevicePrimary: true,
      },
      session: { billSettled: false },
      conversationMeta: { flowNodeId: "explore", dismissedNudges: [] },
      phase: "browsing",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now: Date.parse("2026-06-06T20:15:00.000Z"),
      localHour: 20,
      dayOfWeek: 5,
    });

    expect(mental.predictions.duration.mode).toBe("relaxed");
    expect(mental.pace).toBe("relaxed");
    expect(mental.predictions.trajectory.partySize).toBe(2);
  });
});
