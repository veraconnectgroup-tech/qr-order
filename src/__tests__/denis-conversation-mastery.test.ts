import { describe, expect, it } from "vitest";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  backfillDraftFromOrderMessage,
  maybeBackfillOrderDraft,
} from "@/lib/ai/ordering/order-message-backfill";
import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { buildConversationEvidence } from "@/lib/denis/cognition/conversation/conversation-evidence";
import { foldConversationModel } from "@/lib/denis/cognition/conversation/fold-conversation-model";
import {
  isGuestMisunderstandingDecline,
} from "@/lib/denis/cognition/conversation/guest-continuity";
import { inferAwaitingFromDialogue } from "@/lib/denis/cognition/conversation/infer-awaiting";
import {
  applyGuestCartSwap,
  applyGuestRemoval,
  parseGuestCartSwap,
  parseGuestNegationSwap,
  parseGuestModifier,
  parseGuestRemoval,
  parseGuestSubstitution,
} from "@/lib/denis/cognition/conversation/guest-substitution";
import { parseLeadingOrderQuantity } from "@/lib/denis/cognition/conversation/parse-order-quantity";
import { splitGroupOrderSegments } from "@/lib/denis/cognition/conversation/parse-group-order";
import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import {
  runOrderingMasterySuite,
  ORDERING_MASTERY_CATALOG,
} from "@/lib/denis/eval/fixtures/ordering-mastery/scenarios";
import {
  belief,
  beliefGraph,
  decideTurnPlan,
} from "@/lib/denis/cognition/tde";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex as reflexPlan } from "@/lib/denis/kernel/reflex-plan";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { normalizeTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import type { ConversationAwaiting } from "@/lib/denis/cognition/beliefs/belief-types";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";

function interpretationRow(
  seq: number,
  text: string,
  interpretation: Partial<TurnInterpretation>
): DenisTimelineRow {
  const normalized = normalizeTurnInterpretation(interpretation);
  return row(seq, "perception.ingested", {
    type: "perception.ingested",
    frame: {
      channel: "chat.message",
      normalizedText: text,
      interpretation: normalized,
    },
    interpretation: normalized,
    turnInterpretation: normalized,
  });
}

function testInterpretation(
  overrides: Partial<TurnInterpretation> = {}
): TurnInterpretation {
  return normalizeTurnInterpretation({
    sentiment: "neutral",
    mealStage: "ordering",
    modifications: [],
    preferences: [],
    followUpMinutes: null,
    partySize: null,
    awaiting: null,
    askedDessert: false,
    sidePreference: null,
    cookingPreference: null,
    agreedOrderLine: null,
    guestReferenceKind: null,
    guestReferenceDetail: null,
    ...overrides,
  });
}

function awaitingTimeline(awaiting: ConversationAwaiting): DenisTimelineRow[] {
  return [
    interpretationRow(1, "da", { awaiting }),
  ];
}

function row(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>
): DenisTimelineRow {
  return {
    id: `evt-${seq}`,
    ai_session_id: "ai-1",
    seq,
    event_type: eventType,
    payload,
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: `2026-06-07T12:00:0${seq}.000Z`,
  };
}

function burgerCatalog(): AiCatalog {
  const beef: AiCatalogProduct = {
    id: "beef-burger",
    name: "Beef Burger",
    price: 15,
    imageUrl: null,
    menuSection: "food",
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };
  const chicken: AiCatalogProduct = {
    id: "chicken-burger",
    name: "Chicken Burger",
    price: 14,
    imageUrl: null,
    menuSection: "food",
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };
  const pilsner: AiCatalogProduct = {
    id: "pilsner",
    name: "Pilsner 0.5L",
    price: 4.5,
    imageUrl: null,
    menuSection: "drinks",
    requiresServeSize: false,
    serveSizePresets: ["0.3", "0.5"],
    allowCustomServeSize: false,
    modifierGroups: [],
    taxRate: 19,
    allergens: [],
  };

  const catalog = {
    [beef.id]: beef,
    [chicken.id]: chicken,
    [pilsner.id]: pilsner,
  };

  return {
    menuText: "",
    productMap: catalog,
    catalog,
    currency: "EUR",
    cachedAt: new Date().toISOString(),
  };
}

function reflexFor(message: string, flowNodeId: "collect" | "recap" = "collect") {
  return reflexPlan({
    config: CONCIERGE_PLATFORM_DEFAULTS,
    message,
    flowNodeId,
    cartState: emptyCartState(),
    skipUpsell: false,
  });
}

describe("conversation mastery — infer awaiting", () => {
  it("infers recommendation_pick from burger choice question", () => {
    expect(
      inferAwaitingFromDialogue({
        lastDenisText: "Koji burger? Beef, Chicken ili Veggie?",
        flowNodeId: "collect",
        pendingSlot: null,
        commerceConfirm: false,
        timeline: awaitingTimeline("recommendation_pick"),
      })
    ).toBe("recommendation_pick");
  });

  it("infers confirm from recap question", () => {
    expect(
      inferAwaitingFromDialogue({
        lastDenisText: "Beef Burger i Pilsner. Potvrđujete?",
        flowNodeId: "collect",
        pendingSlot: null,
        commerceConfirm: false,
        timeline: awaitingTimeline("confirm"),
      })
    ).toBe("confirm");
  });

  it("infers serve_size from volume choice question", () => {
    expect(
      inferAwaitingFromDialogue({
        lastDenisText: "Koja veličina piva — 0.3L ili 0.5L?",
        flowNodeId: "collect",
        pendingSlot: null,
        commerceConfirm: false,
        timeline: awaitingTimeline("serve_size"),
      })
    ).toBe("serve_size");
  });

  it("uses pending slot for serve_size", () => {
    expect(
      inferAwaitingFromDialogue({
        lastDenisText: "Koja veličina?",
        flowNodeId: "collect",
        pendingSlot: "serve_size",
        commerceConfirm: false,
      })
    ).toBe("serve_size");
  });
});

describe("conversation mastery — guest substitution & modifiers", () => {
  it("parses bez luka as modifier, not new item", () => {
    const interpretation = testInterpretation({
      modifications: [{ modifier: "bez luka" }],
    });
    const mod = parseGuestModifier("Beef burger ali bez luka", interpretation);
    expect(mod).not.toBeNull();
    expect(mod?.modifier).toMatch(/bez luka/i);
    expect(parseGuestSubstitution("Beef burger ali bez luka", interpretation)).toBeNull();
  });

  it("backfills burger with modifier note", () => {
    const catalog = burgerCatalog();
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      catalog,
      "Beef burger ali bez luka",
      {
        interpretation: testInterpretation({
          modifications: [{ modifier: "bez luka" }],
        }),
      }
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.productName).toMatch(/Beef/i);
    expect(result.draft.items[0]?.notes).toMatch(/bez luka/i);
  });

  it("parses cart swap Chicken umesto Beef", () => {
    const interpretation = testInterpretation({
      modifications: [{ swap: { from: "Beef", to: "Chicken" } }],
    });
    const swap = parseGuestCartSwap("Zapravo daj Chicken umesto Beef", interpretation);
    expect(swap).not.toBeNull();
    expect(swap?.requested).toMatch(/chicken/i);
    expect(swap?.insteadOf).toMatch(/beef/i);
  });

  it("keeps side substitution separate from cart swap", () => {
    const sideSub = testInterpretation({
      modifications: [{ swap: { from: "pomfrit", to: "salata" } }],
    });
    expect(parseGuestCartSwap("salata umesto pomfrita", sideSub)).toBeNull();
    expect(parseGuestSubstitution("salata umesto pomfrita", sideSub)).not.toBeNull();
  });

  it("swaps beef for chicken in cart", () => {
    const catalog = burgerCatalog();
    const draft = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "beef-burger",
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
    const swap = parseGuestCartSwap(
      "Chicken umesto Beef",
      testInterpretation({
        modifications: [{ swap: { from: "Beef", to: "Chicken" } }],
      })
    )!;
    const { draft: next, swapped } = applyGuestCartSwap(draft, swap, catalog.catalog);
    expect(swapped).toBe(true);
    expect(next.items[0]?.productName).toMatch(/Chicken/i);
  });

  it("removes pilsner from cart on odustani", () => {
    const draft = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "pilsner",
          productName: "Pilsner 0.5L",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 4.5,
          menuSection: "drinks" as const,
          productTaxRate: 19,
        },
        {
          productId: "beef-burger",
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
    const removal = parseGuestRemoval("Odustani od Pilsnera")!;
    const { draft: next, removed } = applyGuestRemoval(draft, removal);
    expect(removed).toBe(true);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.productName).toMatch(/Beef/i);
  });
});

describe("conversation mastery — multi-turn ordering", () => {
  it("builds correct cart across 3 turns (burger → beef → pilsner)", () => {
    const catalog = burgerCatalog();

    const turn1 = foldConversationModel({
      timeline: [
        row(1, "signal.message", { type: "signal.message", text: "Hoću burger" }),
        row(2, "tell.committed", {
          type: "tell.committed",
          message: "Koji burger? Beef, Chicken ili Veggie?",
        }),
        interpretationRow(3, "Beef", { awaiting: "recommendation_pick" }),
      ],
      flowNodeId: "collect",
      pendingSlot: null,
      commerceConfirm: false,
    });
    expect(turn1.awaiting).toBe("recommendation_pick");

    let draft = emptyOrderDraft();
    const turn2 = backfillDraftFromOrderMessage(draft, catalog, "Beef", {
      requirePlacementPattern: false,
    });
    draft = turn2.draft;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]?.productName).toMatch(/Beef/i);

    const turn3 = backfillDraftFromOrderMessage(draft, catalog, "Pilsner", {
      requirePlacementPattern: false,
      additive: true,
    });
    draft = turn3.draft;
    expect(draft.items).toHaveLength(2);
    expect(draft.items.some((line) => /Pilsner/i.test(line.productName))).toBe(
      true
    );
    expect(draft.items.some((line) => /Beef/i.test(line.productName))).toBe(
      true
    );

    const confirmModel = foldConversationModel({
      timeline: [
        row(1, "signal.message", { type: "signal.message", text: "Hoću burger" }),
        row(2, "tell.committed", {
          type: "tell.committed",
          message: "Koji burger? Beef, Chicken ili Veggie?",
        }),
        row(3, "signal.message", { type: "signal.message", text: "Beef" }),
        row(4, "tell.committed", {
          type: "tell.committed",
          message: "Beef Burger! Piće uz to?",
        }),
        row(5, "signal.message", { type: "signal.message", text: "Pilsner" }),
        row(6, "tell.committed", {
          type: "tell.committed",
          message: "Beef Burger i Pilsner. Potvrđujete?",
        }),
      ],
      flowNodeId: "recap",
      pendingSlot: null,
      commerceConfirm: true,
    });
    expect(confirmModel.awaiting).toBe("confirm");
    expect(confirmModel.summary).toContain("confirmation");
  });
});

describe("conversation mastery — continuity evidence", () => {
  it("includes last_denis, last_guest, awaiting in situation pack block", () => {
    const model = foldConversationModel({
      timeline: [
        row(1, "tell.committed", {
          type: "tell.committed",
          message: "Beef Burger i Pilsner. Potvrđujete?",
        }),
        row(2, "signal.message", { type: "signal.message", text: "Da" }),
      ],
      flowNodeId: "recap",
      pendingSlot: null,
      commerceConfirm: true,
    });

    const block = buildConversationEvidence(model);
    expect(block).toContain("last_denis_said");
    expect(block).toContain("last_guest_said");
    expect(block).toContain("conversation.awaiting: confirm");
    expect(block).toContain("session_summary");
  });

  it("adds recovery instruction when guest says ne after misunderstanding", () => {
    const model = foldConversationModel({
      timeline: [
        row(1, "tell.committed", {
          type: "tell.committed",
          message: "Dodao sam Veggie Burger. Potvrđujete?",
        }),
        row(2, "signal.message", { type: "signal.message", text: "Ne" }),
      ],
      flowNodeId: "recap",
      pendingSlot: null,
      commerceConfirm: true,
    });

    expect(isGuestMisunderstandingDecline("Ne")).toBe(true);
    const block = buildConversationEvidence(model);
    expect(block).toMatch(/misunderstood|Apologize|re-ask/i);
  });
});

describe("conversation mastery — decideTurnPlan wiring", () => {
  it('routes "Da" at confirm to reflex submit, not new order', () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pressure", "confirm"),
        belief("conversation.awaiting", "confirm"),
        belief("waiter.can_confirm", true),
        belief("waiter.gap_count", 0),
      ]),
      reflex: reflexFor("Da", "recap"),
      message: "Da",
    });
    expect(plan.kind).toBe("reflex_only");
    expect(plan.reason).toBe("commerce.confirm.reflex_submit");
  });

  it('routes bare "ne" at confirm to comprehend recovery', () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pressure", "confirm"),
        belief("conversation.awaiting", "confirm"),
      ]),
      reflex: reflexFor("Ne", "recap"),
      message: "Ne",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.requiresLlm).toBe(true);
    expect(plan.reason).toMatch(/decline_recovery|awaiting_confirm/);
  });

  it('routes short "Beef" pick at recommendation_pick to comprehend', () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("conversation.awaiting", "recommendation_pick"),
        belief("conversation.mode", "ordering"),
        belief("commerce.pressure", "open"),
      ]),
      reflex: reflexFor("Beef"),
      message: "Beef",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.reason).toBe("conversation.awaiting_pick.comprehend");
  });

  it("maybeBackfill on da uses prior order lines from transcript", () => {
    const catalog = burgerCatalog();
    const result = maybeBackfillOrderDraft(emptyOrderDraft(), catalog, "da", [
      {
        role: "user",
        content: "Beef burger i Pilsner",
        timestamp: new Date().toISOString(),
      },
    ]);
    expect(result.draft.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe("conversation mastery — Prompt 86 ordering pipeline", () => {
  function masteryCatalog() {
    return {
      menuText: "",
      productMap: {},
      catalog: ORDERING_MASTERY_CATALOG,
      currency: "EUR",
      cachedAt: new Date().toISOString(),
    };
  }

  it("group order → 4 item-units across 3 lines with personas", () => {
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      masteryCatalog(),
      "Za mene burger, za ženu salatu, i za decu dva sladoleda",
      { requirePlacementPattern: false }
    );
    expect(result.draft.items).toHaveLength(3);
    expect(result.draft.items.reduce((sum, line) => sum + line.quantity, 0)).toBe(
      4
    );
    expect(result.draft.items.some((line) => /Beef/i.test(line.productName))).toBe(
      true
    );
    expect(result.draft.items.some((line) => /Salad|Salat/i.test(line.productName))).toBe(
      true
    );
    expect(result.draft.items.some((line) => /Sladoled/i.test(line.productName))).toBe(
      true
    );
    expect(result.draft.items.find((line) => line.notes.includes("za decu"))?.quantity).toBe(
      2
    );
  });

  it('parses "dva" as quantity 2', () => {
    expect(parseLeadingOrderQuantity("dva sladoleda")?.quantity).toBe(2);
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      masteryCatalog(),
      "dva sladoleda",
      { requirePlacementPattern: false }
    );
    expect(result.draft.items[0]?.quantity).toBe(2);
  });

  it("swap mid-order Pilsner → Weißbier", () => {
    const catalog = masteryCatalog();
    const interpretation = testInterpretation({
      modifications: [{ swap: { from: "Pilsner", to: "Weißbier" } }],
    });
    const draft = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "pilsner",
          productName: "Pilsner 0.5L",
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
    const swap = parseGuestNegationSwap(
      "Zapravo, ne Pilsner nego Weißbier",
      interpretation
    );
    expect(swap).not.toBeNull();
    const { draft: next, swapped } = applyGuestCartSwap(
      draft,
      swap!,
      catalog.catalog
    );
    expect(swapped).toBe(true);
    expect(next.items[0]?.productName).toMatch(/Weißbier/i);
  });

  it("stacks burger modifiers in notes", () => {
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      masteryCatalog(),
      "Burger bez luka, sa extra sirom, medium rare",
      {
        requirePlacementPattern: false,
        interpretation: testInterpretation({
          modifications: [
            { modifier: "bez luka" },
            { modifier: "extra sirom" },
            { cooking: "medium rare" },
          ],
        }),
      }
    );
    expect(result.draft.items).toHaveLength(1);
    const notes = result.draft.items[0]?.notes ?? "";
    expect(notes).toMatch(/bez luka/i);
    expect(notes).toMatch(/extra sirom/i);
    expect(notes).toMatch(/medium rare/i);
  });

  it("fuzzy matches schnitzl, pommes, kola", () => {
    expect(searchCatalogProducts(ORDERING_MASTERY_CATALOG, "schnitzl", 1)[0]?.id).toBe(
      "wiener-schnitzel"
    );
    expect(searchCatalogProducts(ORDERING_MASTERY_CATALOG, "pommes", 1)[0]?.id).toBe(
      "pommes"
    );
    expect(searchCatalogProducts(ORDERING_MASTERY_CATALOG, "kola", 1)[0]?.id).toBe(
      "cola"
    );
  });

  it("splits multi-language order line", () => {
    const segments = splitGroupOrderSegments(
      "Daj mi ein Schnitzel und dva piva please"
    );
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.some((row) => /schnitzel/i.test(row.productText))).toBe(true);
  });

  it("ordering mastery eval fixtures pass", () => {
    const report = runOrderingMasterySuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
  });

  it('routes mid-order swap to transactional perceive', () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief("commerce.pressure", "open"),
        belief("conversation.mode", "ordering"),
      ]),
      reflex: reflexFor("Zapravo, ne Pilsner nego Weißbier"),
      message: "Zapravo, ne Pilsner nego Weißbier",
    });
    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.reason).toBe("commerce.cart_mutation.comprehend");
  });
});
