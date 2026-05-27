import { describe, expect, it } from "vitest";
import { emptyOrderDraft, type AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  finalizeOrderFlow,
  isGuestDecliningMore,
  isGuestFinalConfirm,
} from "@/lib/ai/ordering/order-flow";

function draftWithCola(): AiOrderDraft {
  return {
    ...emptyOrderDraft(),
    items: [
      {
        productId: "cola-zero",
        productName: "Cola Zero",
        quantity: 1,
        modifierIds: [],
        serveSize: "0.3L",
        notes: "",
        lineTotal: 4.5,
        menuSection: "drinks",
        productTaxRate: 19,
      },
    ],
  };
}

describe("order-flow guards", () => {
  it("detects decline phrases", () => {
    expect(isGuestDecliningMore("ne hvala")).toBe(true);
    expect(isGuestDecliningMore("Nein danke")).toBe(true);
    expect(isGuestDecliningMore("da")).toBe(false);
  });

  it("after drink added asks food once", () => {
    const result = finalizeOrderFlow({
      userMessage: "Eine Cola Zero 0,3L",
      draft: draftWithCola(),
      llmMessage: "OK",
      llmSubmitOrder: false,
      cartActionsThisTurn: 1,
      language: "de",
    });

    expect(result.message).toContain("Cola Zero");
    expect(result.message).toContain("essen");
    expect(result.submitOrder).toBe(false);
    expect(result.draft.flow?.foodUpsellAsked).toBe(true);
  });

  it("ne hvala goes straight to confirm recap", () => {
    const draft = {
      ...draftWithCola(),
      flow: { foodUpsellAsked: true },
    };

    const result = finalizeOrderFlow({
      userMessage: "ne hvala",
      draft,
      llmMessage: "Još nešto?",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.message).toContain("Cola Zero");
    expect(result.message).toContain("potvrdite");
    expect(result.submitOrder).toBe(false);
    expect(result.draft.flow?.awaitingFinalConfirm).toBe(true);
  });

  it("da after recap submits order", () => {
    const draft = {
      ...draftWithCola(),
      flow: { foodUpsellAsked: true, awaitingFinalConfirm: true },
    };

    const result = finalizeOrderFlow({
      userMessage: "da",
      draft,
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.submitOrder).toBe(true);
    expect(isGuestFinalConfirm("da")).toBe(true);
  });
});
