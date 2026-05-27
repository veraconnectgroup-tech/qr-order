import { describe, expect, it } from "vitest";
import {
  isLanguageNeutralGuestMessage,
  resolveStickyGuestLanguage,
  tForAiGuestLanguage,
} from "@/lib/ai/guest-language";

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
});
