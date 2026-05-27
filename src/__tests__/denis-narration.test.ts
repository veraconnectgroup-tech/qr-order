import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  buildNarrationFacts,
  lintNarrationMessage,
  sanitizeNarrationOutput,
} from "@/lib/denis/runtime/narrate";

function baseFacts() {
  const reflexTurn = planTurnWithReflex({
    config: CONCIERGE_PLATFORM_DEFAULTS,
    message: "espresso",
    flowNodeId: "collect",
    cartState: {
      ...emptyCartState(),
      draft: {
        cartRevision: 1,
        items: [
          {
            productId: "p1",
            productName: "Espresso",
            quantity: 1,
            serveSize: null,
            modifierIds: [],
            notes: "",
            lineTotal: 3.5,
            menuSection: "drinks",
          },
        ],
      },
    },
  });

  return buildNarrationFacts({
    config: CONCIERGE_PLATFORM_DEFAULTS,
    language: "sr",
    reflexTurn,
    cartActions: [{ productName: "Espresso", quantity: 1 }],
  });
}

describe("narration facts M9", () => {
  it("includes added items in committed facts", () => {
    const facts = baseFacts();
    expect(facts.committed.addedItems).toEqual(["Espresso"]);
    expect(facts.allowedMentions).toContain("Espresso");
  });
});

describe("narration lint M9", () => {
  it("passes message that only mentions allowed products", () => {
    const facts = baseFacts();
    const lint = lintNarrationMessage("Dodao sam Espresso u korpu.", facts);
    expect(lint.ok).toBe(true);
  });

  it("flags unauthorized product mention", () => {
    const facts = baseFacts();
    const lint = lintNarrationMessage(
      "Preporučujem Pizza Hawaii za vas.",
      facts
    );
    expect(lint.ok).toBe(false);
    expect(lint.issues.some((i) => i.code === "UNALLOWED_PRODUCT")).toBe(true);
  });

  it("flags submit claim without order number", () => {
    const facts = baseFacts();
    const lint = lintNarrationMessage("Narudžbina je poslata.", facts);
    expect(lint.ok).toBe(false);
    expect(lint.issues.some((i) => i.code === "UNAUTHORIZED_SUBMIT")).toBe(
      true
    );
  });

  it("falls back to template when lint fails", () => {
    const facts = baseFacts();
    const result = sanitizeNarrationOutput(
      "Narudžbina je poslata sa Pizza Hawaii.",
      facts
    );
    expect(result.usedFallback).toBe(true);
    expect(result.tier).toBe("template");
    expect(result.message).toContain("Espresso");
  });
});
