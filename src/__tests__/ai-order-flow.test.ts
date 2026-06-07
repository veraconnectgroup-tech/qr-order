import { describe, expect, it } from "vitest";
import { emptyOrderDraft, type AiOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  finalizeOrderFlow,
  isGuestAbandoningOrder,
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
    expect(result.message).toContain("Da li je to sve");
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
    expect(result.message).toContain("Da li je to sve");
    expect(result.submitOrder).toBe(false);
    expect(result.draft.flow?.awaitingFinalConfirm).toBe(true);
  });

  it("ne at recap opens cart instead of repeating recap", () => {
    const draft = {
      ...draftWithCola(),
      flow: { foodUpsellAsked: true, awaitingFinalConfirm: true },
    };

    const result = finalizeOrderFlow({
      userMessage: "ne",
      draft,
      llmMessage: "Da li je to sve?\nCola Zero 0.3L",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.message).toContain("šta još");
    expect(result.message).not.toContain("Da li je to sve");
    expect(result.draft.flow?.awaitingFinalConfirm).toBe(false);
    expect(result.submitOrder).toBe(false);
  });

  it("abandon at recap clears cart", () => {
    const draft = {
      ...draftWithCola(),
      flow: { foodUpsellAsked: true, awaitingFinalConfirm: true },
    };

    const result = finalizeOrderFlow({
      userMessage: "ne zelim da porucim nista odustao sam",
      draft,
      llmMessage: "Da li je to sve?",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(isGuestAbandoningOrder("ne zelim da porucim nista odustao sam")).toBe(
      true
    );
    expect(result.draft.items).toHaveLength(0);
    expect(result.message).toContain("poništio");
    expect(result.submitOrder).toBe(false);
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

  it("LLM submitOrder at awaitingFinalConfirm sends order (comprehend-first)", () => {
    const draft = {
      ...draftWithCola(),
      flow: { awaitingFinalConfirm: true },
    };

    for (const message of ["potvrdjujem molim te", "super", "u redu", "tamam"]) {
      const result = finalizeOrderFlow({
        userMessage: message,
        draft,
        llmMessage: "Odlično — šaljem porudžbinu!",
        llmSubmitOrder: true,
        cartActionsThisTurn: 0,
        language: "sr",
      });

      expect(result.submitOrder).toBe(true);
    }
  });

  it("natural affirmative without LLM stays on recap until comprehend", () => {
    const result = finalizeOrderFlow({
      userMessage: "super",
      draft: {
        ...draftWithCola(),
        flow: { awaitingFinalConfirm: true },
      },
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.submitOrder).toBe(false);
    expect(result.message).toContain("Da li je to sve");
  });

  it("blocks false order claim when cart is empty", () => {
    const message = sanitizeFalseOrderClaimMessage({
      message: "Poručujem ti veliko pivo Pilsner.",
      draft: emptyOrderDraft(),
      submitOrder: false,
      language: "sr",
    });

    expect(message).toMatch(/nisam poslao/i);
    expect(message).not.toMatch(/poručujem/i);
  });

  it("rewrites false order claim to confirm recap when cart has items", () => {
    const message = sanitizeFalseOrderClaimMessage({
      message: "Poručujem ti veliko pivo.",
      draft: draftWithCola(),
      submitOrder: false,
      language: "sr",
    });

    expect(message.toLowerCase()).toContain("da li je to sve");
    expect(message).toContain("Cola Zero");
  });

  it("recap format: question then item lines", () => {
    const result = finalizeOrderFlow({
      userMessage: "to je sve",
      draft: { ...draftWithCola(), flow: { foodUpsellAsked: true } },
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.message).toBe("Da li je to sve?\nCola Zero 0.3L");
  });

  it("to je sve at recap submits order", () => {
    const result = finalizeOrderFlow({
      userMessage: "to je sve",
      draft: {
        ...draftWithCola(),
        flow: { foodUpsellAsked: true, awaitingFinalConfirm: true },
      },
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });

    expect(result.submitOrder).toBe(true);
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
