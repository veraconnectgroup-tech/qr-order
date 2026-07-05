import { describe, expect, it } from "vitest";
import {
  applyCartActionsToDraft,
  processProposedItems,
  tryResolveQuickReply,
} from "@/lib/ai/ordering/draft-engine";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";

const COLA_ID = "11111111-1111-4111-8111-111111111111";
const PILS_ID = "22222222-2222-4222-8222-222222222222";
const LEMONADE_ID = "33333333-3333-4333-8333-333333333333";

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
    [PILS_ID]: {
      id: PILS_ID,
      name: "Pilsner",
      price: 4.5,
      imageUrl: null,
      menuSection: "drinks",
      taxRate: 19,
      allergens: [],
      requiresServeSize: true,
      serveSizePresets: ["0.3", "0.5"],
      allowCustomServeSize: false,
      modifierGroups: [],
    },
    [LEMONADE_ID]: {
      id: LEMONADE_ID,
      name: "Fresh Lemonade",
      price: 4.5,
      imageUrl: null,
      menuSection: "drinks",
      taxRate: 19,
      allergens: [],
      requiresServeSize: true,
      serveSizePresets: ["0.3"],
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

  it("infers 0.5L from veliko in the same order message", () => {
    const result = processProposedItems(
      emptyOrderDraft(),
      catalog,
      [
        {
          productId: PILS_ID,
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
        },
      ],
      { userMessage: "moze jedno veliko pivo" }
    );

    expect(result.pending).toBeNull();
    expect(result.cartActions).toHaveLength(1);
    expect(result.cartActions[0]?.serveSize).toBe("0.5L");
    expect(result.draft.items[0]?.serveSize).toBe("0.5L");
  });
});

describe("tryResolveQuickReply — generic affirmation on a single-size pending item", () => {
  it("resolves a bare 'moze' when the product has only one serve size (no silent drop)", () => {
    const proposed = processProposedItems(emptyOrderDraft(), catalog, [
      {
        productId: LEMONADE_ID,
        quantity: 1,
        modifierIds: [],
        serveSize: null,
        notes: "",
      },
    ]);

    expect(proposed.pending).not.toBeNull();
    expect(proposed.cartActions).toHaveLength(0);

    const resolved = tryResolveQuickReply(proposed.draft, "Moze", catalog);

    expect(resolved).not.toBeNull();
    expect(resolved?.cartActions).toHaveLength(1);
    expect(resolved?.cartActions[0]?.productId).toBe(LEMONADE_ID);
    expect(resolved?.draft.pending).toBeNull();
    expect(resolved?.draft.items).toHaveLength(1);
  });

  it("does not guess a size from a bare 'moze' when there are multiple options", () => {
    const proposed = processProposedItems(emptyOrderDraft(), catalog, [
      {
        productId: PILS_ID,
        quantity: 1,
        modifierIds: [],
        serveSize: null,
        notes: "",
      },
    ]);

    expect(proposed.pending).not.toBeNull();

    const resolved = tryResolveQuickReply(proposed.draft, "Moze", catalog);

    expect(resolved).toBeNull();
  });
});
