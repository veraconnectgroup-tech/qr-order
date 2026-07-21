import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  buildNarrationFacts,
  lintNarrationMessage,
  sanitizeNarrationOutput,
  templateNarrationFallback,
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

function reflexTurnWithGoal(topGoal: unknown) {
  return {
    reflex: null,
    correction: null,
    conflict: null,
    plan: { topGoal },
    cartState: { draft: { items: [], cartRevision: 0 }, orders: [] },
    usedT0: false,
    handoffCommand: null,
    handoffPaymentMethod: null,
    pipelineHints: { reflexIntent: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("narration facts — pending-slot and handoff kind (quality-audit fix)", () => {
  it("threads the real pending-slot kind into committed facts for CLARIFY_SLOT", () => {
    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "en",
      reflexTurn: reflexTurnWithGoal({
        type: "CLARIFY_SLOT",
        slot: { kind: "serve_size" },
        priority: 80,
      }),
    });
    expect(facts.committed.pendingSlotKind).toBe("serve_size");
  });

  it("threads the real handoff kind into committed facts for HANDOFF", () => {
    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "en",
      reflexTurn: reflexTurnWithGoal({
        type: "HANDOFF",
        kind: "payment",
        priority: 96,
      }),
    });
    expect(facts.committed.handoffKind).toBe("payment");
  });

  it("template fallback asks about the actual pending slot, not payment, when narration is unavailable", () => {
    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "en",
      reflexTurn: reflexTurnWithGoal({
        type: "CLARIFY_SLOT",
        slot: { kind: "modifier" },
        priority: 80,
      }),
    });
    const fallback = templateNarrationFallback(facts);
    expect(fallback).not.toMatch(/pay|cash|card/i);
    expect(fallback).toMatch(/prepared/i);
  });

  it("template fallback still asks about payment when the pending slot really is payment_method (regression)", () => {
    const facts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "en",
      reflexTurn: reflexTurnWithGoal({
        type: "CLARIFY_SLOT",
        slot: { kind: "payment_method" },
        priority: 80,
      }),
    });
    expect(templateNarrationFallback(facts)).toBe(
      "How would you like to pay — cash, card at the table, or online?"
    );
  });

  it("template fallback differentiates payment handoff wording from the default waiter wording", () => {
    const paymentFacts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "en",
      reflexTurn: reflexTurnWithGoal({
        type: "HANDOFF",
        kind: "payment",
        priority: 96,
      }),
    });
    const waiterFacts = buildNarrationFacts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      language: "en",
      reflexTurn: reflexTurnWithGoal({
        type: "HANDOFF",
        kind: "waiter",
        priority: 96,
      }),
    });
    expect(templateNarrationFallback(waiterFacts)).toBe(
      "On my way — just a moment."
    );
    expect(templateNarrationFallback(paymentFacts)).not.toBe(
      templateNarrationFallback(waiterFacts)
    );
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
