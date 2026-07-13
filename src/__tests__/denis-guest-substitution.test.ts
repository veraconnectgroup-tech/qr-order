import { describe, expect, it } from "vitest";
import {
  buildSubstitutionNegotiationMessage,
  isGenericBeerSegment,
  parseGuestRemoval,
  parseGuestSubstitution,
} from "@/lib/denis/cognition/conversation/guest-substitution";
import { backfillDraftFromOrderMessage } from "@/lib/ai/ordering/order-message-backfill";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { normalizeTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import { EMPTY_TURN_INTERPRETATION } from "@/lib/denis/cognition/tde/turn-interpretation-types";

function mockCatalog(): AiCatalog {
  const burger: AiCatalogProduct = {
    id: "beef-burger",
    name: "Beef Burger",
    price: 15,
    imageUrl: null,
    menuSection: "food",
    requiresServeSize: false,
    serveSizePresets: [],
    allowCustomServeSize: false,
    modifierGroups: [
      {
        id: "sides",
        name: "Prilog",
        isRequired: false,
        minSelect: 0,
        maxSelect: 1,
        modifiers: [
          { id: "fries", name: "Pomfrit", price: 0 },
          { id: "salad", name: "Kartoffelsalat", price: 0 },
        ],
      },
    ],
    taxRate: 19,
    allergens: [],
  };

  return {
    menuText: "",
    productMap: { "beef-burger": burger },
    catalog: { "beef-burger": burger },
    currency: "EUR",
    cachedAt: new Date().toISOString(),
  };
}

describe("guest substitution", () => {
  it("parses umesto pomfrita on burger line", () => {
    const interpretation = normalizeTurnInterpretation({
      modifications: [{ swap: { from: "pomfrit", to: "kartoffel salata" } }],
    });
    const sub = parseGuestSubstitution(
      "veliki beef burger sa kartoffel salatom umesto pomfrita",
      interpretation
    );
    expect(sub).not.toBeNull();
    expect(sub?.insteadOf).toMatch(/pomfrit/i);
  });

  it("detects generic beer segment", () => {
    expect(isGenericBeerSegment("jedno pivo")).toBe(true);
    expect(isGenericBeerSegment("Pilsner 0.5L")).toBe(false);
  });

  it("builds negotiation message with drink clarify and substitution", () => {
    const msg = buildSubstitutionNegotiationMessage("sr", {
      cartSummary: "1× Beef Burger",
      substitution: {
        requested: "kartoffel salata",
        insteadOf: "pomfrit",
        rawPhrase: "kartoffel salata umesto pomfrita",
      },
      needsDrinkClarify: true,
    });
    expect(msg).toMatch(/Beef Burger/i);
    expect(msg).toMatch(/konobar/i);
    expect(msg).toMatch(/Pilsner|Weizen/i);
  });

  it("backfills burger with note and flags generic beer", async () => {
    const interpretation = normalizeTurnInterpretation({
      modifications: [{ swap: { from: "pomfrit", to: "kartoffel salata" } }],
    });
    const result = await backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      mockCatalog(),
      "jedno pivo, veliki beef burger sa kartoffel salatom umesto pomfrita",
      { interpretation }
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.productName).toBe("Beef Burger");
    expect(result.draft.items[0]?.notes).toBe("");
    expect(result.meta.needsDrinkClarify).toBe(true);
    expect(result.meta.substitution).not.toBeNull();
  });

  it("parseGuestRemoval reads cancelItem from real LLM turnInterpretation", () => {
    // The router-fallback regex only recognizes a fixed set of phrasings
    // ("odustani od", "cancel", "ukloni"...) — a real LLM interpretation can
    // recognize a removal request phrased in an entirely different way.
    const interpretation = {
      ...EMPTY_TURN_INTERPRETATION,
      modifications: [{ cancelItem: "Pilsner" }],
    };
    const result = parseGuestRemoval("scratch the beer, actually", interpretation);
    expect(result?.target).toBe("Pilsner");
  });

  it("parseGuestRemoval falls back to router regex when no real interpretation given", () => {
    const result = parseGuestRemoval("Odustani od Pilsnera");
    expect(result?.target).toMatch(/Pilsnera/i);
  });

  it("parseGuestRemoval returns null when interpretation has no cancelItem", () => {
    const interpretation = { ...EMPTY_TURN_INTERPRETATION };
    const result = parseGuestRemoval("hvala puno", interpretation);
    expect(result).toBeNull();
  });
});
