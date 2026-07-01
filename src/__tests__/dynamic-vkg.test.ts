import { describe, expect, it } from "vitest";
import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";
import { pairingFor } from "@/lib/denis/kernel/vkg/queries";
import {
  discoverPairings,
  formatDiscoveredPairingLine,
  formatLearnedPairingGuestPrompt,
  type LearnedPairing,
} from "@/lib/denis/intelligence/dynamic-vkg";

const BURGER = "burger-id";
const PILSNER = "pilsner-id";
const DRINK = "drink-id";

function mockOrders(pairCount: number, total: number) {
  const orders = [];
  for (let i = 0; i < total; i += 1) {
    const items =
      i < pairCount
        ? [
            { productId: BURGER, createdAt: "2026-06-01T12:00:00Z" },
            { productId: PILSNER, createdAt: "2026-06-01T12:05:00Z" },
          ]
        : [{ productId: DRINK, createdAt: "2026-06-01T12:00:00Z" }];
    orders.push({
      id: `order-${i}`,
      createdAt: "2026-06-01T12:00:00Z",
      items,
    });
  }
  return orders;
}

function learnedBurgerPilsner(): LearnedPairing {
  return {
    productA: BURGER,
    productB: PILSNER,
    coOrderCount: 30,
    confidence: 1,
    lift: 2.1,
    support: 0.5,
    avgTimeBetween: 0,
    direction: "simultaneous",
    source: "order_history",
    autoAdd: true,
    needsApproval: false,
  };
}

describe("dynamic VKG X1", () => {
  it("discovers burger+pilsner with autoAdd when lift >= 2", () => {
    const pairings = discoverPairings({
      orders: mockOrders(30, 60),
      minCoOccurrence: 5,
      lookbackDays: 30,
    });

    const burgerPilsner = pairings.find(
      (pair) =>
        (pair.productA === BURGER && pair.productB === PILSNER) ||
        (pair.productA === PILSNER && pair.productB === BURGER)
    );

    expect(burgerPilsner).toBeDefined();
    expect(burgerPilsner?.coOrderCount).toBe(30);
    expect(burgerPilsner?.lift).toBeGreaterThanOrEqual(2);
    expect(burgerPilsner?.autoAdd).toBe(true);
    expect(burgerPilsner?.confidence).toBeGreaterThan(0.3);
    expect(burgerPilsner?.support).toBeGreaterThan(0.05);
  });

  it("50-order window with 30 burger+pilsner baskets stays above approval band", () => {
    const pairings = discoverPairings({
      orders: mockOrders(30, 50),
      minCoOccurrence: 5,
      lookbackDays: 30,
    });

    const burgerPilsner = pairings.find(
      (pair) =>
        (pair.productA === BURGER && pair.productB === PILSNER) ||
        (pair.productA === PILSNER && pair.productB === BURGER)
    );

    expect(burgerPilsner).toBeDefined();
    expect(burgerPilsner?.coOrderCount).toBe(30);
    expect(burgerPilsner?.lift).toBeGreaterThan(1.5);
    expect(burgerPilsner?.needsApproval || burgerPilsner?.autoAdd).toBe(true);
  });

  it("ignores pairs below minimum co-occurrence", () => {
    const pairings = discoverPairings({
      orders: mockOrders(3, 10),
      minCoOccurrence: 5,
    });
    expect(pairings).toHaveLength(0);
  });

  it("formats Denis guest prompt for learned pairing", () => {
    expect(
      formatLearnedPairingGuestPrompt({
        anchorName: "Burger",
        suggestName: "Pilsner",
      })
    ).toBe("Gosti koji naruče Burger često uzmu i Pilsner — hoćete?");
  });

  it("formats staff copilot stats line", () => {
    const line = formatDiscoveredPairingLine(learnedBurgerPilsner(), {
      [BURGER]: "Burger",
      [PILSNER]: "Pilsner",
    });
    expect(line).toContain("Burger → Pilsner");
    expect(line).toContain("lift 2.1");
    expect(line).toContain("auto-added");
  });
});

describe("pairingFor merge — static + learned VKG", () => {
  it("merges admin upsell with learned basket pairing", () => {
    const graph = buildVenueKnowledgeGraph({
      locationId: "loc-1",
      categories: [{ id: "cat-food", name: "Food", menu_section: "food" }],
      products: [
        {
          id: BURGER,
          name: "Burger",
          category_id: "cat-food",
          price: 12,
          is_available: true,
          allergens: [],
          ai_description: null,
          menu_section: "food",
        },
        {
          id: PILSNER,
          name: "Pilsner",
          category_id: "cat-food",
          price: 4,
          is_available: true,
          allergens: [],
          ai_description: null,
          menu_section: "drinks",
        },
      ],
      upsellRules: [],
    });

    const pairings = pairingFor(graph, [BURGER], {
      learnedPairings: [learnedBurgerPilsner()],
    });

    expect(pairings).toHaveLength(1);
    expect(pairings[0]?.name).toBe("Pilsner");
    expect(pairings[0]?.source).toBe("learned");
    expect(pairings[0]?.reason).toContain("Gosti koji naruče Burger");
  });
});
