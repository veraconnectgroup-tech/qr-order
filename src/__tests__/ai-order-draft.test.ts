import { describe, expect, it } from "vitest";
import {
  applyCartActionsToDraft,
  processProposedItems,
} from "@/lib/ai/ordering/draft-engine";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";

const COLA_ID = "11111111-1111-4111-8111-111111111111";

const catalog: AiCatalog = {
  menuText: "",
  productMap: {},
  currency: "EUR",
  cachedAt: new Date().toISOString(),
  catalog: {
    [COLA_ID]: {
      id: COLA_ID,
      name: "Cola",
      price: 4.17,
      imageUrl: null,
      menuSection: "drinks",
      taxRate: 19,
      allergens: [],
      requiresServeSize: false,
      serveSizePresets: [],
      allowCustomServeSize: false,
      modifierGroups: [],
    },
  },
};

function colaAction(quantity = 1) {
  return {
    productId: COLA_ID,
    productName: "Cola",
    unitPrice: 4.17,
    quantity,
    notes: "",
    serveSize: null,
    menuSection: "drinks" as const,
    productTaxRate: 19,
    modifiers: [],
    lineTotal: 4.17 * quantity,
  };
}

describe("applyCartActionsToDraft", () => {
  it("appends a new line on first add", () => {
    const { draft, appliedActions } = applyCartActionsToDraft(
      emptyOrderDraft(),
      [colaAction()]
    );

    expect(appliedActions).toHaveLength(1);
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].quantity).toBe(1);
  });

  it("skips duplicate recap of the same item", () => {
    const first = applyCartActionsToDraft(emptyOrderDraft(), [colaAction()]);
    const second = applyCartActionsToDraft(first.draft, [colaAction()]);

    expect(second.appliedActions).toHaveLength(0);
    expect(second.draft.items).toHaveLength(1);
    expect(second.draft.cartRevision).toBe(first.draft.cartRevision);
  });

  it("increments quantity when guest asks for another", () => {
    const first = applyCartActionsToDraft(emptyOrderDraft(), [colaAction()]);
    const second = applyCartActionsToDraft(first.draft, [colaAction()], {
      userMessage: "Donesi mi jos jednu colu",
    });

    expect(second.appliedActions).toHaveLength(1);
    expect(second.draft.items).toHaveLength(1);
    expect(second.draft.items[0].quantity).toBe(2);
  });
});

describe("processProposedItems", () => {
  it("does not duplicate items already in the draft", () => {
    const first = processProposedItems(emptyOrderDraft(), catalog, [
      {
        productId: COLA_ID,
        quantity: 1,
        modifierIds: [],
        serveSize: null,
        notes: "",
      },
    ]);

    const second = processProposedItems(first.draft, catalog, [
      {
        productId: COLA_ID,
        quantity: 1,
        modifierIds: [],
        serveSize: null,
        notes: "",
      },
    ]);

    expect(second.cartActions).toHaveLength(0);
    expect(second.draft.items).toHaveLength(1);
  });
});
