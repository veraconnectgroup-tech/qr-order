import { describe, expect, it } from "vitest";
import { emptyOrderDraft, type AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  finalizeOrderFlow,
  isGuestDecliningMore,
  isGuestDoneOrdering,
  isGuestFinalConfirm,
  sanitizeFalseOrderClaimMessage,
  shouldHandleOrderFlowWithoutLlm,
} from "@/lib/ai/ordering/order-flow";
import { pendingSlotKindFromDraft } from "@/lib/ai/ordering/pending-slot-kind";

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

  it("detects done-ordering phrases in Croatian", () => {
    expect(isGuestDoneOrdering("ne to je sve")).toBe(true);
    expect(isGuestDoneOrdering("to je sve nista drugo hvala")).toBe(true);
    expect(isGuestDoneOrdering("samo to")).toBe(true);
  });

  it("skips LLM for done-ordering when cart has items", () => {
    const draft = {
      ...draftWithCola(),
      flow: { foodUpsellAsked: true },
    };

    expect(shouldHandleOrderFlowWithoutLlm("ne to je sve", draft)).toBe(true);
    expect(shouldHandleOrderFlowWithoutLlm("ne to je sve", emptyOrderDraft())).toBe(
      false
    );
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

  it("ne to je sve goes straight to confirm recap", () => {
    const draft = {
      ...draftWithCola(),
      flow: { foodUpsellAsked: true },
    };

    const result = finalizeOrderFlow({
      userMessage: "ne to je sve",
      draft,
      llmMessage: "Sorry, I didn't catch that — could you try again?",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.message).toContain("Cola Zero");
    expect(result.message).toContain("potvrdite");
    expect(result.submitOrder).toBe(false);
    expect(result.draft.flow?.awaitingFinalConfirm).toBe(true);
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

  it("LLM submitOrder at awaitingFinalConfirm sends order (not regex)", () => {
    const result = finalizeOrderFlow({
      userMessage: "potvrdjujem molim te",
      draft: {
        ...draftWithCola(),
        flow: { awaitingFinalConfirm: true },
      },
      llmMessage: "Odlično — šaljem porudžbinu!",
      llmSubmitOrder: true,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.submitOrder).toBe(true);
    expect(result.message).toMatch(/šaljem/i);
  });

  it("blocks false order claim when cart is empty", () => {
    const message = sanitizeFalseOrderClaimMessage({
      message: "Poručujem ti veliko pivo Pilsner.",
      draft: emptyOrderDraft(),
      submitOrder: false,
      language: "sr",
    });

    expect(message).toContain("prazna");
    expect(message).not.toMatch(/poručujem/i);
  });

  it("rewrites false order claim to confirm recap when cart has items", () => {
    const message = sanitizeFalseOrderClaimMessage({
      message: "Poručujem ti veliko pivo.",
      draft: draftWithCola(),
      submitOrder: false,
      language: "sr",
    });

    expect(message).toContain("potvrdite");
    expect(message).toContain("Cola Zero");
  });

  it("maps draft.pending serve size to serve_size slot kind", () => {
    const draft: AiOrderDraft = {
      ...emptyOrderDraft(),
      pending: {
        productId: "pils",
        productName: "Pilsner",
        quantity: 1,
        modifierIds: [],
        notes: "",
        missing: [{ kind: "serveSize", options: ["0.3L", "0.5L"] }],
      },
    };

    expect(pendingSlotKindFromDraft(draft)).toBe("serve_size");
  });
});
