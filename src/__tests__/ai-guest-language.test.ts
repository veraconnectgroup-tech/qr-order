import { describe, expect, it } from "vitest";
import { detectGuestMessageLanguage } from "@/lib/ai/config";
import {
  isLanguageNeutralGuestMessage,
  resolveStickyGuestLanguage,
  tForAiGuestLanguage,
} from "@/lib/ai/guest-language";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import { finalizeOrderFlow } from "@/lib/ai/ordering/order-flow";

describe("sticky guest language", () => {
  it("detects German without umlauts", () => {
    expect(detectGuestMessageLanguage("Ein Grosses bier bitte", "en")).toEqual({
      detected: "de",
      confidence: "high",
    });
    expect(
      resolveStickyGuestLanguage("Ein Grosses bier bitte", "en", "en")
    ).toBe("de");
  });

  it("keeps German session on drink size reply", () => {
    expect(isLanguageNeutralGuestMessage("0.5")).toBe(true);
    expect(resolveStickyGuestLanguage("0.5", "en", "de")).toBe("de");
  });

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

  it("detects casual Serbian without order keywords", () => {
    expect(
      resolveStickyGuestLanguage("Denis legendo gde si sta si", "de", "en")
    ).toBe("sr");
    expect(detectGuestMessageLanguage("Denis legendo gde si sta si", "de")).toEqual({
      detected: "sr",
      confidence: "high",
    });
  });

  it("honors explicit request to continue in Serbian", () => {
    expect(
      resolveStickyGuestLanguage("nein weiter nur auf serbisch", "de", "en")
    ).toBe("sr");
  });

  it("respects followGuest=false — always venue locale", () => {
    expect(
      resolveStickyGuestLanguage("da može hvala", "de", "en", {
        followGuest: false,
      })
    ).toBe("de");
  });

  it("uses preferred language on neutral confirms when no session", () => {
    expect(
      resolveStickyGuestLanguage("yes please", "de", null, {
        preferredLanguage: "sr",
      })
    ).toBe("sr");
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
          menuSection: "drinks" as const,
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
    expect(result.message).toContain("Da li je to sve");
    expect(result.message).toContain("Craft IPA");
    expect(result.message).not.toContain("Please confirm");
  });
});
