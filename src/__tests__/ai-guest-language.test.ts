import { describe, expect, it } from "vitest";
import {
  isLanguageNeutralGuestMessage,
  resolveStickyGuestLanguage,
  tForAiGuestLanguage,
} from "@/lib/ai/guest-language";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import { finalizeOrderFlow } from "@/lib/ai/ordering/order-flow";

describe("sticky guest language", () => {
  it("detects Serbian from Latin script message", () => {
    expect(
      resolveStickyGuestLanguage("da može hvala", "en", null)
    ).toBe("sr");
  });

  it("keeps Serbian session on yes please", () => {
    expect(
      resolveStickyGuestLanguage("yes please", "en", "sr")
    ).toBe("sr");
    expect(isLanguageNeutralGuestMessage("yes please")).toBe(true);
  });

  it("keeps Serbian session on da confirm", () => {
    expect(resolveStickyGuestLanguage("da", "de", "sr")).toBe("sr");
  });

  it("renders submit approval in Serbian", () => {
    const text = tForAiGuestLanguage("ai.order.submitApproval", "sr", {
      number: "8",
    });
    expect(text).toContain("Porudžbina");
    expect(text).toContain("8");
    expect(text).not.toMatch(/waiting for table approval/i);
  });

  it("confirm flow uses Serbian when language is sr", () => {
    const draft = {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "p1",
          productName: "Craft IPA",
          quantity: 1,
          modifierIds: [],
          serveSize: "0.5L",
          notes: "",
          lineTotal: 5.5,
          menuSection: "drinks",
          productTaxRate: 19,
        },
      ],
      flow: { foodUpsellAsked: true },
    };
    const result = finalizeOrderFlow({
      userMessage: "ne hvala",
      draft,
      llmMessage: "",
      llmSubmitOrder: false,
      cartActionsThisTurn: 0,
      language: "sr",
    });
    expect(result.message).toContain("potvrdite");
    expect(result.message).not.toContain("Please confirm");
  });
});
