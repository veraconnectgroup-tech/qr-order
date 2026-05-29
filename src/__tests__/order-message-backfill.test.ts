import { describe, expect, it } from "vitest";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  backfillDraftFromOrderMessage,
  isOrderPlacementMessage,
  maybeBackfillOrderDraft,
  splitOrderMessageSegments,
} from "@/lib/ai/ordering/order-message-backfill";
import { finalizeOrderFlow } from "@/lib/ai/ordering/order-flow";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";

function mockCatalog(): AiCatalog {
  const kisela = {
    id: "drink-1",
    name: "Kisela voda",
    price: 3.5,
    imageUrl: null,
    menuSection: "drinks" as const,
    requiresServeSize: true,
    serveSizePresets: ["0.3", "0.5"],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };
  const pivo = {
    id: "drink-2",
    name: "Veliko pivo",
    price: 5,
    imageUrl: null,
    menuSection: "drinks" as const,
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };
  const pilsner = {
    id: "drink-3",
    name: "Pilsner 0,3L",
    price: 4.5,
    imageUrl: null,
    menuSection: "drinks" as const,
    requiresServeSize: false,
    serveSizePresets: ["0.3", "0.5"],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };
  const burger = {
    id: "food-1",
    name: "Beef burger",
    price: 12,
    imageUrl: null,
    menuSection: "food" as const,
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [
      {
        id: "g1",
        name: "Prilog",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        modifiers: [
          { id: "mod-fries", name: "Pomfrit", price: 2 },
        ],
      },
    ],
    taxRate: 19,
    allergens: [],
  };

  const catalog = {
    [kisela.id]: kisela,
    [pivo.id]: pivo,
    [pilsner.id]: pilsner,
    [burger.id]: burger,
  };

  return {
    menuText: "",
    productMap: {},
    catalog,
    currency: "EUR",
    cachedAt: new Date().toISOString(),
  };
}

describe("order message backfill", () => {
  it("splits multi-item Serbian order", () => {
    const segments = splitOrderMessageSegments(
      "Daj mi kiselu malu, veliko pivo i beef burger sa ponesom"
    );
    expect(segments.length).toBeGreaterThanOrEqual(3);
  });

  it("detects order placement vs confirm", () => {
    expect(
      isOrderPlacementMessage("Daj mi kiselu malu i pivo")
    ).toBe(true);
    expect(isOrderPlacementMessage("da")).toBe(false);
  });

  it("does not backfill generic jedno veliko pivo to a random beer", () => {
    const catalog = mockCatalog();
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "jedno veliko pivo"
    );
    expect(result.cartActions).toHaveLength(0);
    expect(result.draft.items).toHaveLength(0);
  });

  it("backfills draft from catalog search", () => {
    const catalog = mockCatalog();
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "Daj mi kiselu malu, veliko pivo i beef burger sa pomfritom"
    );
    expect(result.cartActions.length).toBeGreaterThanOrEqual(2);
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });

  it("maybeBackfill uses prior user message on da", () => {
    const catalog = mockCatalog();
    const result = maybeBackfillOrderDraft(
      emptyOrderDraft(),
      catalog,
      "da",
      [
        {
          role: "user",
          content: "Daj mi kiselu malu, veliko pivo i beef burger sa pomfritom",
          timestamp: new Date().toISOString(),
        },
      ]
    );
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });

  it("maybeBackfill on da recovers bare product name (Pilsner)", () => {
    const catalog = mockCatalog();
    const result = maybeBackfillOrderDraft(
      emptyOrderDraft(),
      catalog,
      "Da",
      [
        {
          role: "assistant",
          content: "Poručio si Pilsner 0,3L za 4,50 €.",
          timestamp: new Date().toISOString(),
        },
        {
          role: "user",
          content: "Pilsner 0,3l",
          timestamp: new Date().toISOString(),
        },
      ]
    );
    expect(result.draft.items.length).toBe(1);
    expect(result.draft.items[0]?.productName).toMatch(/Pilsner/i);
  });

  it("finalizeOrderFlow submits when awaiting confirm and draft has items", () => {
    const catalog = mockCatalog();
    const backfill = maybeBackfillOrderDraft(emptyOrderDraft(), catalog, "da", [
      {
        role: "user",
        content: "Pilsner 0,3l",
        timestamp: new Date().toISOString(),
      },
    ]);
    const draft = {
      ...backfill.draft,
      flow: { awaitingFinalConfirm: true },
    };
    const result = finalizeOrderFlow({
      userMessage: "da",
      draft,
      llmMessage: "Porudžbina je još prazna.",
      llmSubmitOrder: true,
      cartActionsThisTurn: 0,
      language: "sr",
    });
    expect(result.submitOrder).toBe(true);
  });

  it("finalizeOrderFlow does not submit with empty cart", () => {
    const result = finalizeOrderFlow({
      userMessage: "da",
      draft: emptyOrderDraft(),
      llmMessage: "No items to order.",
      llmSubmitOrder: true,
      cartActionsThisTurn: 0,
      language: "sr",
    });
    expect(result.submitOrder).toBe(false);
  });
});
