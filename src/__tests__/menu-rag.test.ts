import { describe, expect, it } from "vitest";
import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { MenuRagCatalog } from "@/lib/denis/cognition/context/menu-rag-types";
import {
  isMenuRagEnabled,
  MENU_RAG_MIN_CATALOG_CAPABILITY,
  retrieveMenuEvidence,
} from "@/lib/denis/cognition/context/retrievers/menu-rag";

function product(
  id: string,
  name: string,
  allergens: string[] = []
): AiCatalogProduct {
  return {
    id,
    name,
    price: 10,
    imageUrl: null,
    menuSection: "food",
    taxRate: 19,
    allergens,
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
  };
}

function mockCatalog(): MenuRagCatalog {
  return {
    "food-1": product("food-1", "Pilsner 0,3L"),
    "food-2": product("food-2", "Veliko pivo"),
    "food-3": product("food-3", "Pileća salata", []),
    "food-4": product("food-4", "Hleb sa sirom", ["gluten", "milk"]),
    "food-5": product("food-5", "Rižoto sa povrćem", []),
  };
}

describe("menu-rag gate", () => {
  it("enables when catalog_rag capability meets minimum", () => {
    expect(
      isMenuRagEnabled({ catalogRagLevel: MENU_RAG_MIN_CATALOG_CAPABILITY })
    ).toBe(true);
    expect(
      isMenuRagEnabled({ catalogRagLevel: MENU_RAG_MIN_CATALOG_CAPABILITY - 1 })
    ).toBe(false);
  });

  it("enables when elite.menuRagEnabled override is true", () => {
    expect(
      isMenuRagEnabled({
        catalogRagLevel: 0,
        menuRagEnabled: true,
      })
    ).toBe(true);
  });

  it("stays off when capability and override are both low", () => {
    expect(
      isMenuRagEnabled({
        catalogRagLevel: 0,
        menuRagEnabled: false,
      })
    ).toBe(false);
  });
});

describe("retrieveMenuEvidence", () => {
  it("returns empty evidence for blank query", () => {
    expect(retrieveMenuEvidence("", mockCatalog())).toEqual({
      productIds: [],
      snippet: "",
    });
  });

  it("matches products by keyword via catalog-search", () => {
    const evidence = retrieveMenuEvidence("pivo", mockCatalog());

    expect(evidence.productIds).toContain("food-2");
    expect(evidence.snippet).toContain("[food-2] Veliko pivo");
    for (const productId of evidence.productIds) {
      expect(mockCatalog()[productId]).toBeDefined();
    }
  });

  it("returns gluten-free products for 'Nešto bez glutena'", () => {
    const catalog = mockCatalog();
    const evidence = retrieveMenuEvidence("Nešto bez glutena", catalog);

    expect(evidence.productIds.length).toBeGreaterThan(0);
    expect(evidence.productIds).not.toContain("food-4");
    for (const productId of evidence.productIds) {
      expect(catalog[productId]?.allergens).not.toContain("gluten");
    }
    expect(evidence.snippet).toMatch(/\[food-/);
  });

  it("respects maxResults option", () => {
    const evidence = retrieveMenuEvidence("Nešto bez glutena", mockCatalog(), {
      maxResults: 2,
    });

    expect(evidence.productIds).toHaveLength(2);
  });
});
