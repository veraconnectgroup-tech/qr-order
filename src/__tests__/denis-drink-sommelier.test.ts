import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { resolveSituationalDrinkOffer } from "@/lib/denis/cognition/offer/situational-drink-offer";
import {
  detectPartyDrinkGapTrigger,
  detectSommelierFoodPairingTrigger,
  detectSommelierRefillTrigger,
} from "@/lib/denis/cognition/proactive/drink-sommelier-triggers";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  avgDrinkDurationMinutes,
  formatSommelierPairingMessage,
  isOccasionAllowed,
  resolveDrinkOccasion,
  suggestDrinksForFood,
} from "@/lib/denis/intelligence/drink-sommelier";
import {
  classifyDrinkKnowledge,
  mocktailFor,
} from "@/lib/denis/kernel/vkg/drink-knowledge-graph";
import { detectPartyDrinkGap } from "@/lib/denis/venue/party/group-drink-dynamics";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";

const now = Date.parse("2026-06-07T20:00:00.000Z");

function foodOrder(id: string, productName: string): AiGuestOrder {
  return {
    id,
    status: "preparing",
    created_at: new Date(now - 60_000).toISOString(),
    delivered_at: null,
    order_items: [
      {
        product_id: "food-id",
        product_name: productName,
        unit_price: 18,
        quantity: 1,
        menu_section: "food",
      },
    ],
  };
}

function drinkOrder(
  id: string,
  productName: string,
  deliveredMinutesAgo: number,
  orderMinutesAgo = 22
): AiGuestOrder {
  return {
    id,
    status: "delivered",
    created_at: new Date(now - orderMinutesAgo * 60_000).toISOString(),
    delivered_at: new Date(now - deliveredMinutesAgo * 60_000).toISOString(),
    order_items: [
      {
        product_id: "drink-id",
        product_name: productName,
        unit_price: 4,
        quantity: 1,
        menu_section: "drinks",
      },
    ],
  };
}

const rankMessages = {
  browse: "",
  dessert: "",
  slowKitchen: "",
  guestWelcome: "",
  browseFollowUp: "",
  billPrompt: "",
  orderDelay: "",
  popularityPair: "",
};

describe("drink knowledge graph", () => {
  it("classifies Pilsner as Light Lager pairing with salty food", () => {
    const node = classifyDrinkKnowledge("Pilsner 0.5L");
    expect(node.category).toBe("beer");
    expect(node.family).toBe("Light Lager");
    expect(node.pairsWith).toContain("salty");
  });

  it("maps Aperol Spritz to aperitif with mocktail alternative", () => {
    const node = classifyDrinkKnowledge("Aperol Spritz");
    expect(node.family).toBe("Aperitif");
    expect(mocktailFor("Aperol Spritz")).toBe("Aperol Spritz 0%");
  });
});

describe("food-drink sommelier pairing", () => {
  it("steak → Cabernet Sauvignon ili Pilsner", () => {
    const suggestion = suggestDrinksForFood("Steak", "pairing");
    expect(suggestion?.primary).toBe("Cabernet Sauvignon");
    expect(suggestion?.secondary).toBe("Pilsner");

    const message = formatSommelierPairingMessage({
      suggestion: suggestion!,
      language: "sr",
    });
    expect(message).toContain("Steak");
    expect(message).toContain("Cabernet Sauvignon");
    expect(message).toContain("Pilsner");
  });

  it("salad → Sauvignon Blanc ili Radler", () => {
    const suggestion = suggestDrinksForFood("Ceasar salata", "pairing");
    expect(suggestion?.primary).toBe("Sauvignon Blanc");
    expect(suggestion?.secondary).toBe("Radler");
  });

  it("fires sommelier pairing trigger for steak order", () => {
    const trigger = detectSommelierFoodPairingTrigger(
      [foodOrder("steak-1", "Steak")],
      () => false,
      now,
      { sessionPhase: "waiting" }
    );
    expect(trigger?.kind).toBe("sommelier_pairing");
    expect(trigger?.message).toContain("Cabernet Sauvignon");
  });
});

describe("situational drink occasion", () => {
  it("suggests aperitif before food, not digestif", () => {
    const occasion = resolveDrinkOccasion({
      mealStage: "aperitif",
      hasFoodDelivered: false,
    });
    expect(occasion).toBe("aperitif");
    expect(isOccasionAllowed("digestif", "aperitif", false)).toBe(false);

    const offer = resolveSituationalDrinkOffer({
      mealStage: "aperitif",
      hasFoodDelivered: false,
    });
    expect(offer?.occasion).toBe("aperitif");
    expect(offer?.primary).toBe("Aperol Spritz");
  });

  it("allows digestif only after food delivered", () => {
    expect(isOccasionAllowed("digestif", "post_meal", true)).toBe(true);
    expect(isOccasionAllowed("digestif", "pre_order", false)).toBe(false);
  });
});

describe("drink refill prediction", () => {
  it("beer refill target is ~20 minutes", () => {
    expect(avgDrinkDurationMinutes("Pilsner 0.5L")).toBe(20);
    expect(avgDrinkDurationMinutes("Cabernet Sauvignon")).toBe(30);
    expect(avgDrinkDurationMinutes("Negroni")).toBe(25);
  });

  it("20min after beer → sommelier refill trigger", () => {
    const orders = [drinkOrder("d1", "Pilsner 0.5L", 16, 22)];
    const trigger = detectSommelierRefillTrigger(orders, {
      isShown: () => false,
      now,
    });
    expect(trigger?.kind).toBe("sommelier_refill");
    expect(trigger?.message).toContain("Pilsner");
    expect(trigger?.message).toContain("Još jedno");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders,
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now,
    });
    expect(ranked.some((row) => row.nudge.kind === "sommelier_refill")).toBe(
      true
    );
  });
});

describe("group drink dynamics", () => {
  it("3/4 have drinks → ask missing guest once", () => {
    const orders = [
      drinkOrder("d1", "Pilsner", 10, 30),
      drinkOrder("d2", "Pilsner", 10, 30),
      drinkOrder("d3", "Pilsner", 10, 30),
    ];

    const gap = detectPartyDrinkGap({
      partySize: 4,
      orders,
      isShown: () => false,
    });
    expect(gap?.missingCount).toBe(1);
    expect(gap?.devicesWithDrink).toBe(3);

    const trigger = detectPartyDrinkGapTrigger({
      orders,
      partySize: 4,
      isShown: () => false,
    });
    expect(trigger?.kind).toBe("party_drink_gap");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders,
      partyFacts: {
        partySize: 4,
        devicesWithOrder: 3,
        orderedRatio: 0.75,
        partyMode: "per_device",
        minutesSinceLastOrder: null,
        isPartyIncomplete: true,
        isPartyIncompleteForCurrentDevice: true,
        currentDeviceHasOrdered: false,
      },
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now,
    });
    expect(ranked.some((row) => row.nudge.kind === "party_drink_gap")).toBe(
      true
    );
  });
});

describe("situation pack sommelier bar block", () => {
  it("includes drink_occasion and sommelier_pairing for steak", () => {
    const pack = buildSituationPack({
      state: {
        table: { id: "t1", name: "T4", token: "tok" },
        session: {
          id: "s1",
          status: "active",
          accessState: null,
          billSettled: false,
          feedbackSubmitted: false,
          denisEnabled: true,
          denisActive: true,
        },
        party: {
          activeDeviceCount: 4,
          partyMode: "individual",
          isCurrentDevicePrimary: true,
          devices: [],
        },
        commerce: {
          orders: [
            {
              id: "f1",
              status: "preparing",
              createdAt: new Date(now - 60_000).toISOString(),
              items: [
                {
                  productName: "Steak",
                  quantity: 1,
                  menuSection: "food",
                },
              ],
            },
          ],
          cart: { ai: emptyCartState(), visibleLines: [] },
        },
        config: CONCIERGE_PLATFORM_DEFAULTS,
        mental: emptyGuestMentalModel(now),
      } as never,
      beliefs: beliefGraph([]),
      sessionPhase: "waiting",
    });

    expect(pack).toContain("BAR:");
    expect(pack).toContain("drink_occasion: pairing");
    expect(pack).toContain("sommelier_pairing: Steak");
    expect(pack).toContain("Cabernet Sauvignon");
  });
});
