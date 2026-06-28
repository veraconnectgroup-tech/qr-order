import { describe, expect, it } from "vitest";
import {
  analyzeMenu,
  buildPuzzleNudgeMessage,
  classifyMenuEngineeringItem,
  detectSeasonalMenuShift,
  formatMenuEngineeringDigestLines,
  isMenuEngineeringBlocked,
  menuEngineeringScoreMultiplier,
  pickMenuEngineeringDessert,
  pickStarPopularityPair,
  simulateMenuEngineeringRevenueImpact,
} from "@/lib/denis/platform/menu-engineering";

const PRODUCT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function productId(index: number): string {
  const hex = index.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4aaa-8aaa-aaaaaaaaaaaa`;
}

describe("menu-engineering K2", () => {
  it("classifies high volume + high price as star", () => {
    expect(
      classifyMenuEngineeringItem({
        orderCount: 50,
        price: 25,
        medianVolume: 10,
        medianPrice: 15,
      })
    ).toBe("star");
    expect(menuEngineeringScoreMultiplier("star")).toBe(1.2);
    expect(isMenuEngineeringBlocked("star")).toBe(false);
  });

  it("classifies low-volume cheap item as dog with 30-day window", () => {
    const insight = analyzeMenu({
      lookbackDays: 30,
      products: [
        {
          id: PRODUCT_A,
          name: "Cheap Side",
          price: 3,
          isAvailable: true,
        },
        {
          id: PRODUCT_B,
          name: "Premium Steak",
          price: 45,
          isAvailable: true,
        },
      ],
      orderHistory: [
        {
          productId: PRODUCT_A,
          productName: "Cheap Side",
          quantity: 2,
          revenueCents: 600,
        },
        {
          productId: PRODUCT_B,
          productName: "Premium Steak",
          quantity: 20,
          revenueCents: 90_000,
        },
      ],
    });

    const cheap = insight.items.find((item) => item.productId === PRODUCT_A);
    expect(insight.hasEnoughData).toBe(true);
    expect(cheap?.category).toBe("dog");
    expect(cheap?.suggestion).toBe("Kandidat za uklanjanje");
    expect(isMenuEngineeringBlocked(cheap?.category)).toBe(true);
    expect(menuEngineeringScoreMultiplier(cheap?.category)).toBe(0);
  });

  it("distributes 20 items evenly across BCG quadrants", () => {
    const products = Array.from({ length: 20 }, (_, index) => {
      const quadrant = Math.floor(index / 5);
      const price = quadrant === 0 || quadrant === 1 ? 20 : 5;
      return {
        id: productId(index),
        name: `Item ${index + 1}`,
        price,
        isAvailable: true,
      };
    });

    const orderHistory = products.flatMap((product, index) => {
      const quadrant = Math.floor(index / 5);
      const quantity = quadrant === 0 || quadrant === 2 ? 50 : 2;
      return [
        {
          productId: product.id,
          productName: product.name,
          quantity,
          revenueCents: Math.round(product.price * quantity * 100),
        },
      ];
    });

    const insight = analyzeMenu({
      lookbackDays: 30,
      products,
      orderHistory,
    });

    expect(insight.byCategory.star).toHaveLength(5);
    expect(insight.byCategory.puzzle).toHaveLength(5);
    expect(insight.byCategory.workhorse).toHaveLength(5);
    expect(insight.byCategory.dog).toHaveLength(5);
  });

  it("formats digest lines by BCG category", () => {
    const lines = formatMenuEngineeringDigestLines(
      analyzeMenu({
        lookbackDays: 30,
        products: [
          {
            id: PRODUCT_B,
            name: "Premium Steak",
            price: 45,
            isAvailable: true,
          },
        ],
        orderHistory: [
          {
            productId: PRODUCT_B,
            productName: "Premium Steak",
            quantity: 12,
            revenueCents: 54_000,
          },
        ],
      })
    );

    expect(lines.some((line) => line.includes("Stars"))).toBe(true);
  });

  it("prefers puzzle desserts and star popularity pairs", () => {
    const categories = {
      [PRODUCT_A]: "puzzle" as const,
      [PRODUCT_B]: "star" as const,
      [PRODUCT_C]: "star" as const,
    };

    expect(
      pickMenuEngineeringDessert({
        desserts: [
          { id: PRODUCT_C, name: "Tiramisu" },
          { id: PRODUCT_A, name: "Cheesecake" },
        ],
        categories,
      })
    ).toBe("Cheesecake");

    expect(
      pickStarPopularityPair({
        products: [
          { id: PRODUCT_B, name: "Steak" },
          { id: PRODUCT_C, name: "Risotto" },
        ],
        categories,
      })
    ).toEqual({ from: "Steak", to: "Risotto" });
  });

  it("builds puzzle nudge copy in Serbian", () => {
    expect(buildPuzzleNudgeMessage("Tartar od tune")).toBe(
      "Jeste li probali naš Tartar od tune?"
    );
  });

  it("simulates revenue impact when removing dogs and promoting stars", () => {
    const insight = analyzeMenu({
      lookbackDays: 30,
      products: [
        { id: PRODUCT_A, name: "Dog Side", price: 4, isAvailable: true },
        { id: PRODUCT_B, name: "Star Steak", price: 40, isAvailable: true },
      ],
      orderHistory: [
        {
          productId: PRODUCT_A,
          productName: "Dog Side",
          quantity: 3,
          revenueCents: 1200,
        },
        {
          productId: PRODUCT_B,
          productName: "Star Steak",
          quantity: 40,
          revenueCents: 160_000,
        },
      ],
    });

    const impact = simulateMenuEngineeringRevenueImpact({
      insight,
      dogsToRemove: 1,
      starsToPromote: 1,
    });

    expect(impact.dogsRemoved).toBe(1);
    expect(impact.starsAdded).toBe(1);
    expect(impact.summaryLine).toMatch(/Ako uklonite 1 dog itema i dodate 1 star/);
    expect(impact.summaryLine).toMatch(/\/ned$/);
  });

  it("detects summer salad stars and winter soup stars", () => {
    const saladId = PRODUCT_A;
    const soupId = PRODUCT_B;

    const items = [
      {
        productId: saladId,
        name: "Cezar salata",
        category: "star" as const,
        orderCount: 30,
        revenueCents: 90_000,
        avgRating: null,
        suggestion: "Nastavi promovirati",
        price: 12,
      },
      {
        productId: soupId,
        name: "Pileća supa",
        category: "dog" as const,
        orderCount: 2,
        revenueCents: 800,
        avgRating: null,
        suggestion: "Kandidat za uklanjanje",
        price: 6,
      },
    ];

    const summer = detectSeasonalMenuShift({
      items,
      products: [
        { id: saladId, name: "Cezar salata", price: 12, isAvailable: true },
        { id: soupId, name: "Pileća supa", price: 6, isAvailable: true },
      ],
      orderHistory: [
        {
          productId: saladId,
          productName: "Cezar salata",
          quantity: 30,
          revenueCents: 90_000,
        },
        {
          productId: soupId,
          productName: "Pileća supa",
          quantity: 2,
          revenueCents: 800,
        },
      ],
      nowMs: Date.UTC(2026, 6, 15),
    });

    expect(summer?.season).toBe("summer");
    expect(summer?.lines.some((line) => line.includes("Cezar salata"))).toBe(
      true
    );
    expect(summer?.lines.some((line) => line.includes("Pileća supa"))).toBe(
      true
    );
  });
});
