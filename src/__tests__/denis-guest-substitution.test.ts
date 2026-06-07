import { describe, expect, it } from "vitest";
import {
  buildSubstitutionNegotiationMessage,
  isGenericBeerSegment,
  parseGuestSubstitution,
} from "@/lib/denis/cognition/conversation/guest-substitution";
import { backfillDraftFromOrderMessage } from "@/lib/ai/ordering/order-message-backfill";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import type { AiCatalog, AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";

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
    const sub = parseGuestSubstitution(
      "veliki beef burger sa kartoffel salatom umesto pomfrita"
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

  it("backfills burger with note and flags generic beer", () => {
    const result = backfillDraftFromOrderMessage(
      emptyOrderDraft(),
      mockCatalog(),
      "jedno pivo, veliki beef burger sa kartoffel salatom umesto pomfrita"
    );
    expect(result.draft.items).toHaveLength(1);
    expect(result.draft.items[0]?.productName).toBe("Beef Burger");
    expect(result.draft.items[0]?.notes).toBe("");
    expect(result.meta.needsDrinkClarify).toBe(true);
    expect(result.meta.substitution).not.toBeNull();
  });
});
