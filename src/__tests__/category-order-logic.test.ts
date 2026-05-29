import { describe, expect, it } from "vitest";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import {
  buildOrderComprehendHint,
  isGenericBeerCategoryOrder,
  isGenericCategorySegment,
  isMenuKnowledgeQuestion,
} from "@/lib/ai/ordering/category-order-logic";
import {
  inferServeSizeFromPresets,
  messageImpliesServeSize,
  unionVolumePresets,
} from "@/lib/ai/ordering/serve-size-logic";

function beer(id: string, name: string): AiCatalogProduct {
  return {
    id,
    name,
    price: 5,
    imageUrl: null,
    menuSection: "drinks",
    taxRate: 19,
    allergens: [],
    modifierGroups: [],
    requiresServeSize: true,
    serveSizePresets: ["0.3L", "0.5L"],
    allowCustomServeSize: false,
  };
}

const catalog = {
  [beer("p-pils", "Pilsner").id]: beer("p-pils", "Pilsner"),
  [beer("p-weizen", "Weizen Schneider").id]: beer("p-weizen", "Weizen Schneider"),
};

describe("category-order-logic", () => {
  it("detects generic beer orders vs named beers", () => {
    expect(isGenericBeerCategoryOrder("jedno veliko pivo")).toBe(true);
    expect(isGenericBeerCategoryOrder("Pilsner veliko")).toBe(false);
    expect(isGenericBeerCategoryOrder("Weizen molim")).toBe(false);
  });

  it("detects menu knowledge questions", () => {
    expect(isMenuKnowledgeQuestion("sta je to Weizen, kakvo je to pivo?")).toBe(
      true
    );
    expect(isMenuKnowledgeQuestion("jedno pivo")).toBe(false);
  });

  it("treats veliko pivo segment as generic category", () => {
    expect(isGenericCategorySegment("jedno veliko pivo")).toBe(true);
    expect(isGenericCategorySegment("Pilsner 0.5")).toBe(false);
  });

  it("infers 0.5L from veliko against union presets", () => {
    const presets = unionVolumePresets(Object.values(catalog));
    expect(presets).toEqual(["0.3L", "0.5L"]);
    expect(inferServeSizeFromPresets("jedno veliko pivo", presets)).toBe("0.5L");
    expect(messageImpliesServeSize("jedno veliko pivo")).toBe(true);
  });

  it("builds hint to ask only Pilsner vs Weizen when size implied", () => {
    const hint = buildOrderComprehendHint("jedno veliko pivo", catalog);
    expect(hint).toContain("0.5L");
    expect(hint).toContain("Pilsner");
    expect(hint).toContain("Weizen");
    expect(hint).toMatch(/do NOT ask 0\.3L vs 0\.5L/i);
  });

  it("builds menu knowledge hint for Weizen questions", () => {
    const hint = buildOrderComprehendHint(
      "sta je Weizen, kakvo je to pivo?",
      catalog
    );
    expect(hint).toContain("MENU KNOWLEDGE HINT");
    expect(hint).toMatch(/wheat|description|menu/i);
  });
});
