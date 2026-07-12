import { describe, expect, it } from "vitest";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { OrderSizeIntentAssessment } from "@/lib/ai/ordering/order-size-intent-types";
import {
  isGenericCategorySegment,
  isMenuKnowledgeQuestion,
  menuKnowledgeHint,
  resolveOrderSizeHint,
} from "@/lib/ai/ordering/category-order-logic";

function beer(id: string, name: string, drinkFamily: string | null = "beer"): AiCatalogProduct {
  return {
    id,
    name,
    price: 5,
    imageUrl: null,
    menuSection: "drinks",
    taxRate: 19,
    allergens: [],
    drinkFamily,
    modifierGroups: [],
    requiresServeSize: true,
    serveSizePresets: ["0.3L", "0.5L"],
    allowCustomServeSize: false,
  };
}

// Realistic, well-tagged venue: branded beer names with no literal
// "beer"/"pivo" in them, but properly tagged drinkFamily — exactly the
// case a name-only fuzzy search (the pre-2026-07-12 approach) would miss.
const catalog = {
  [beer("p-pils", "Pilsner").id]: beer("p-pils", "Pilsner"),
  [beer("p-weizen", "Weizen Schneider").id]: beer("p-weizen", "Weizen Schneider"),
};

function assessment(
  overrides: Partial<OrderSizeIntentAssessment>
): OrderSizeIntentAssessment {
  return {
    namesSpecificProduct: false,
    productNameGuess: null,
    isGenericDrinkRequest: false,
    genericCategoryGuess: null,
    sizePreference: "unspecified",
    confidence: 0.9,
    quotedSpan: "",
    ...overrides,
  };
}

describe("resolveOrderSizeHint — driven by LLM perception, not regex", () => {
  it("returns null with no assessment (LLM perceive unavailable)", () => {
    expect(resolveOrderSizeHint(null, catalog)).toBeNull();
  });

  it("resolves a named product's size directly when confidently matched (2026-07-12: 'veliko Pilsner' bug)", () => {
    const hint = resolveOrderSizeHint(
      assessment({
        namesSpecificProduct: true,
        productNameGuess: "Pilsner",
        sizePreference: "larger",
        quotedSpan: "veliko Pilsner",
      }),
      catalog
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("Pilsner");
    expect(hint).toContain("0.5L");
    expect(hint).toContain("p-pils");
    expect(hint).toMatch(/do NOT ask which size again/i);
  });

  it("resolves the smaller size for a 'smaller' preference", () => {
    const hint = resolveOrderSizeHint(
      assessment({
        namesSpecificProduct: true,
        productNameGuess: "Weizen Schneider",
        sizePreference: "smaller",
        quotedSpan: "malo Weizen",
      }),
      catalog
    );
    expect(hint).toContain("0.3L");
    expect(hint).toContain("p-weizen");
  });

  it("returns null for a named product when the LLM didn't perceive a size preference", () => {
    const hint = resolveOrderSizeHint(
      assessment({
        namesSpecificProduct: true,
        productNameGuess: "Pilsner",
        sizePreference: "unspecified",
      }),
      catalog
    );
    expect(hint).toBeNull();
  });

  it("returns null for a named product guess that doesn't confidently match the real catalog (no hallucinated product)", () => {
    const hint = resolveOrderSizeHint(
      assessment({
        namesSpecificProduct: true,
        productNameGuess: "Completely Unrelated Cocktail Nobody Serves Here",
        sizePreference: "larger",
      }),
      catalog
    );
    expect(hint).toBeNull();
  });

  it("builds a hint grounding real product names for a generic category request, no size stated", () => {
    const hint = resolveOrderSizeHint(
      assessment({
        isGenericDrinkRequest: true,
        genericCategoryGuess: "beer",
        quotedSpan: "jedno pivo",
      }),
      catalog
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("Pilsner");
    expect(hint).toContain("Weizen Schneider");
    expect(hint).toMatch(/ask which one and what size/i);
    expect(hint).toMatch(/never invent/i);
  });

  it("builds a hint with size already resolved for a generic category request WITH a size preference", () => {
    const hint = resolveOrderSizeHint(
      assessment({
        isGenericDrinkRequest: true,
        genericCategoryGuess: "beer",
        sizePreference: "larger",
        quotedSpan: "jedno veliko pivo",
      }),
      catalog
    );
    expect(hint).toContain("0.5L");
    expect(hint).toContain("Pilsner");
    expect(hint).toContain("Weizen Schneider");
    expect(hint).toMatch(/do NOT ask which size again/i);
  });

  it("falls back to fuzzy name search when a venue hasn't tagged drinkFamily", () => {
    const untaggedCatalog = {
      "p-lager": beer("p-lager", "House Lager Beer", null),
      "p-craft": beer("p-craft", "Craft Beer Selection", null),
    };
    const hint = resolveOrderSizeHint(
      assessment({ isGenericDrinkRequest: true, genericCategoryGuess: "beer" }),
      untaggedCatalog
    );
    expect(hint).not.toBeNull();
    expect(hint).toContain("House Lager Beer");
    expect(hint).toContain("Craft Beer Selection");
  });

  it("returns null for a generic category with fewer than 2 real matches to disambiguate between", () => {
    const oneBeer = { [beer("p-pils", "Pilsner").id]: beer("p-pils", "Pilsner") };
    const hint = resolveOrderSizeHint(
      assessment({ isGenericDrinkRequest: true, genericCategoryGuess: "beer" }),
      oneBeer
    );
    expect(hint).toBeNull();
  });

  it("returns null when the assessment identifies neither a specific product nor a generic request", () => {
    const hint = resolveOrderSizeHint(assessment({}), catalog);
    expect(hint).toBeNull();
  });
});

describe("isMenuKnowledgeQuestion / menuKnowledgeHint", () => {
  it("detects menu knowledge questions", () => {
    expect(isMenuKnowledgeQuestion("sta je to Weizen, kakvo je to pivo?")).toBe(
      true
    );
    expect(isMenuKnowledgeQuestion("jedno pivo")).toBe(false);
  });

  it("builds a static menu knowledge hint", () => {
    expect(menuKnowledgeHint()).toContain("MENU KNOWLEDGE HINT");
  });
});

describe("isGenericCategorySegment (used by order-message-backfill.ts, unrelated to LLM hint)", () => {
  it("treats veliko pivo segment as generic category", () => {
    expect(isGenericCategorySegment("jedno veliko pivo")).toBe(true);
    expect(isGenericCategorySegment("Pilsner 0.5")).toBe(false);
  });
});
