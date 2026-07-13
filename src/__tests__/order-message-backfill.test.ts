import { describe, expect, it } from "vitest";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  appendOrderGapClarify,
  backfillDraftFromOrderMessage,
  extractOrderMessageMeta,
  isOrderPlacementMessage,
  maybeBackfillOrderDraft,
  splitOrderMessageSegments,
} from "@/lib/ai/ordering/order-message-backfill";
import { finalizeOrderFlow } from "@/lib/ai/ordering/order-flow";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { EMPTY_TURN_INTERPRETATION } from "@/lib/denis/cognition/tde/turn-interpretation-types";
import type { OrderSegmentsAssessment } from "@/lib/ai/ordering/order-segments-types";

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
  const greenTea = {
    id: "drink-4",
    name: "Zeleni čaj",
    price: 3,
    imageUrl: null,
    menuSection: "drinks" as const,
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };
  const chickenBurger = {
    id: "food-2",
    name: "Pileći burger",
    price: 11,
    imageUrl: null,
    menuSection: "food" as const,
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [
      {
        id: "g2",
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
  const cevap = {
    id: "food-3",
    name: "Ćevap",
    price: 8,
    imageUrl: null,
    menuSection: "food" as const,
    requiresServeSize: false,
    serveSizePresets: [],
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
    [greenTea.id]: greenTea,
    [burger.id]: burger,
    [chickenBurger.id]: chickenBurger,
    [cevap.id]: cevap,
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
    expect(isOrderPlacementMessage("veliki pils zeleni caj molim te")).toBe(
      true
    );
    expect(isOrderPlacementMessage("da")).toBe(false);
  });

  it("adds new lines to an existing draft (additive backfill)", async () => {
    const catalog = mockCatalog();
    const existing = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "drink-3",
          productName: "Pilsner 0,3L",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 4.5,
          menuSection: "drinks" as const,
          productTaxRate: 19,
        },
      ],
    };
    const result = await backfillDraftFromOrderMessage(
      existing,
      catalog,
      "dodaj pileci burger i jedan cevap",
      { additive: true }
    );
    expect(result.cartActions.length).toBeGreaterThanOrEqual(1);
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });

  it("backfills beer + tea combo without explicit i connector", async () => {
    const catalog = mockCatalog();
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "veliki pils zeleni caj molim te"
    );
    expect(result.cartActions.length).toBeGreaterThanOrEqual(2);
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });

  it("does not backfill generic jedno veliko pivo to a random beer", async () => {
    const catalog = mockCatalog();
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "jedno veliko pivo"
    );
    expect(result.cartActions).toHaveLength(0);
    expect(result.draft.items).toHaveLength(0);
  });

  it("backfills draft from catalog search", async () => {
    const catalog = mockCatalog();
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "Daj mi kiselu malu, Pilsner 0.5 i beef burger sa pomfritom"
    );
    expect(result.cartActions.length).toBeGreaterThanOrEqual(2);
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });

  it("maybeBackfill uses prior user message on da", async () => {
    const catalog = mockCatalog();
    const result = await maybeBackfillOrderDraft(
      emptyOrderDraft(),
      catalog,
      "da",
      [
        {
          role: "user",
          content: "Daj mi kiselu malu, Pilsner 0.5 i beef burger sa pomfritom",
          timestamp: new Date().toISOString(),
        },
      ]
    );
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });

  it("maybeBackfill on da recovers bare product name (Pilsner)", async () => {
    const catalog = mockCatalog();
    const result = await maybeBackfillOrderDraft(
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

  it("finalizeOrderFlow submits when awaiting confirm and draft has items", async () => {
    const catalog = mockCatalog();
    const backfill = await maybeBackfillOrderDraft(emptyOrderDraft(), catalog, "da", [
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

  it("extractOrderMessageMeta flags generic pivo in compact line", async () => {
    const meta = await extractOrderMessageMeta("moze jedno pivo beef burger sa");
    expect(meta.needsDrinkClarify).toBe(true);
  });

  it("maybeBackfill keeps drink clarify meta when cart already has items", async () => {
    const catalog = mockCatalog();
    const draft = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "food-1",
          productName: "Beef Burger",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 15,
          menuSection: "food" as const,
          productTaxRate: 19,
        },
      ],
    };
    const result = await maybeBackfillOrderDraft(
      draft,
      catalog,
      "moze jedno pivo beef burger sa",
      []
    );
    expect(result.meta.needsDrinkClarify).toBe(true);
    expect(result.cartActions).toHaveLength(0);
  });

  it("uses real LLM turnInterpretation for plain modifiers the regex fallback can't see", async () => {
    // synthesizeTurnInterpretationFromRouter only ever derives "X umesto Y"
    // swaps from regex — a plain modifier like "bez luka" is invisible to it.
    // Passing the LLM's own turnInterpretation must surface it.
    const catalog = mockCatalog();
    const interpretation = {
      ...EMPTY_TURN_INTERPRETATION,
      preferences: ["bez luka"],
    };
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "Beef burger bez luka",
      { interpretation }
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.notes).toMatch(/bez luka/i);
  });

  it("maybeBackfillOrderDraft threads real interpretation through for the current message", async () => {
    const catalog = mockCatalog();
    const interpretation = {
      ...EMPTY_TURN_INTERPRETATION,
      preferences: ["bez luka"],
    };
    const result = await maybeBackfillOrderDraft(
      emptyOrderDraft(),
      catalog,
      "Beef burger bez luka",
      [],
      interpretation
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.notes).toMatch(/bez luka/i);
  });

  it("does not misapply current-turn interpretation to a reconstructed prior message on confirm", async () => {
    const catalog = mockCatalog();
    // This interpretation belongs to the CURRENT turn's text ("da"), not the
    // prior order message being reconstructed — must not leak across.
    const interpretation = {
      ...EMPTY_TURN_INTERPRETATION,
      preferences: ["bez luka"],
    };
    const result = await maybeBackfillOrderDraft(
      emptyOrderDraft(),
      catalog,
      "da",
      [
        {
          role: "user",
          content: "Beef burger",
          timestamp: new Date().toISOString(),
        },
      ],
      interpretation
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.notes ?? "").not.toMatch(/bez luka/i);
  });

  it("regex fallback asks for clarification on bare generic pivo (no assessment)", async () => {
    const catalog = mockCatalog();
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "pivo",
      { segmentsAssessment: null }
    );
    expect(result.draft.items).toHaveLength(0);
    expect(result.meta.needsDrinkClarify).toBe(true);
  });

  it("real LLM segmentation resolves a specific product where the regex fallback would ask for clarification", async () => {
    // "pivo" alone is generic to the regex fallback (isGenericBeerSegment) and
    // never resolves — a real LLM segment assessment can know from context
    // which product the guest meant and resolve it directly.
    const catalog = mockCatalog();
    const assessment: OrderSegmentsAssessment = {
      isOrderPlacement: true,
      segments: [
        {
          quotedSpan: "pivo",
          quantity: 1,
          personaHint: null,
          productNameGuess: "Pilsner 0,3L",
          isGenericCategory: false,
          categoryGuess: null,
          modifierText: null,
        },
      ],
      confidence: 0.9,
    };
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "pivo",
      { segmentsAssessment: assessment }
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.productName).toMatch(/Pilsner/i);
  });

  it("appendOrderGapClarify adds drink question to recap", () => {
    const draft = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "food-1",
          productName: "Beef Burger",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 15,
          menuSection: "food" as const,
          productTaxRate: 19,
        },
      ],
    };
    const message = appendOrderGapClarify(
      "Da li je to sve?\nBeef Burger",
      "sr",
      draft,
      { substitution: null, needsDrinkClarify: true }
    );
    expect(message).toContain("Da li je to sve");
    expect(message).toMatch(/Pilsner|Weizen/i);
  });
});
