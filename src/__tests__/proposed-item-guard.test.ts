import { describe, expect, it } from "vitest";
import {
  classMismatchGuestNote,
  guardProposedItemsAgainstMenu,
  unavailableItemsGuestNote,
} from "@/lib/ai/ordering/proposed-item-guard";
import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import type { AiProposedItem } from "@/lib/ai/ordering/draft-types";

function product(overrides: Partial<AiCatalogProduct> & { id: string; name: string }): AiCatalogProduct {
  return {
    price: 5,
    imageUrl: null,
    menuSection: "drinks",
    taxRate: null,
    allergens: [],
    modifierGroups: [],
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    ...overrides,
  };
}

function catalogFrom(products: AiCatalogProduct[]): AiCatalog {
  const catalog: Record<string, AiCatalogProduct> = {};
  for (const p of products) catalog[p.id] = p;
  return {
    menuText: "",
    productMap: catalog,
    catalog,
    currency: "EUR",
    cachedAt: new Date().toISOString(),
  };
}

function proposed(productId: string): AiProposedItem[] {
  return [{ productId, quantity: 1, notes: "" } as AiProposedItem];
}

describe("guardProposedItemsAgainstMenu", () => {
  it("drops a wine proposal for a beer request when the venue actually serves beer", () => {
    const wine = product({ id: "wine-1", name: "Pinot Grigio", drinkFamily: "wine" });
    const beer = product({ id: "beer-1", name: "Pilsner", drinkFamily: "beer", tags: ["beer"] });
    const catalog = catalogFrom([wine, beer]);

    const result = guardProposedItemsAgainstMenu({
      proposedItems: proposed("wine-1"),
      catalog,
      userMessage: "jedno veliko pivo",
    });

    expect(result.items).toHaveLength(0);
    expect(result.droppedCount).toBe(1);
    expect(result.unavailableTerms).toHaveLength(0);
    expect(result.classMatchAlternatives).toContain("Pilsner");
  });

  it("produces a guest note pointing to the real beer options, not a false not-on-menu note", () => {
    const wine = product({ id: "wine-1", name: "Pinot Grigio", drinkFamily: "wine" });
    const beer = product({ id: "beer-1", name: "Pilsner", drinkFamily: "beer", tags: ["beer"] });
    const catalog = catalogFrom([wine, beer]);

    const result = guardProposedItemsAgainstMenu({
      proposedItems: proposed("wine-1"),
      catalog,
      userMessage: "jedno veliko pivo",
    });

    const note = classMismatchGuestNote(result.classMatchAlternatives, "sr");
    expect(note).toContain("Pilsner");
    expect(note).not.toMatch(/nemamo/i);
  });

  it("still drops and reports unavailable when the venue truly has no beer", () => {
    const wine = product({ id: "wine-1", name: "Pinot Grigio", drinkFamily: "wine" });
    const catalog = catalogFrom([wine]);

    const result = guardProposedItemsAgainstMenu({
      proposedItems: proposed("wine-1"),
      catalog,
      userMessage: "jedno veliko pivo",
    });

    expect(result.items).toHaveLength(0);
    expect(result.unavailableTerms).toContain("pivo");
    expect(unavailableItemsGuestNote(result.unavailableTerms, "sr")).toMatch(/nemamo/i);
  });

  it("keeps the item when the LLM correctly proposes a beer for a beer request", () => {
    const beer = product({ id: "beer-1", name: "Pilsner", drinkFamily: "beer", tags: ["beer"] });
    const catalog = catalogFrom([beer]);

    const result = guardProposedItemsAgainstMenu({
      proposedItems: proposed("beer-1"),
      catalog,
      userMessage: "jedno veliko pivo",
    });

    expect(result.items).toHaveLength(1);
    expect(result.droppedCount).toBe(0);
  });
});
