import { describe, expect, it } from "vitest";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";

function product(id: string, name: string): AiCatalogProduct {
  return {
    id,
    name,
    price: 10,
    imageUrl: null,
    menuSection: "food",
    taxRate: 19,
    allergens: [],
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
  };
}

const catalog: Record<string, AiCatalogProduct> = {
  "drink-1": product("drink-1", "Pilsner 0,3L"),
  "food-1": product("food-1", "Classic Burger"),
  "drink-2": product("drink-2", "Espresso"),
};

describe("searchCatalogProducts — fuzzy typo matching", () => {
  it('finds burger from "bruger" typo', () => {
    const matches = searchCatalogProducts(catalog, "bruger");
    expect(matches.map((entry) => entry.name)).toContain("Classic Burger");
  });

  it('finds espresso from "espreso" typo', () => {
    const matches = searchCatalogProducts(catalog, "espreso");
    expect(matches.map((entry) => entry.name)).toContain("Espresso");
  });

  it('finds pivo from "povo" typo', () => {
    const beerCatalog: Record<string, AiCatalogProduct> = {
      "drink-3": product("drink-3", "Veliko pivo"),
    };
    const matches = searchCatalogProducts(beerCatalog, "povo");
    expect(matches.map((entry) => entry.name)).toContain("Veliko pivo");
  });
});
