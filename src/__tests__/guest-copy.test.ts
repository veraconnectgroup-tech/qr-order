import { describe, expect, it } from "vitest";
import {
  cartAddedMessage,
  normalizeGuestChatLanguage,
  waiterAckMessage,
} from "@/lib/denis/runtime/act/guest-copy";

describe("guest-copy", () => {
  it("normalizes chat language to de/en/sr", () => {
    expect(normalizeGuestChatLanguage("de-DE")).toBe("de");
    expect(normalizeGuestChatLanguage("en")).toBe("en");
    expect(normalizeGuestChatLanguage("sr")).toBe("sr");
    expect(normalizeGuestChatLanguage("hr")).toBe("sr");
  });

  it("waiterAckMessage sounds like a waiter, not a POS", () => {
    expect(waiterAckMessage("de", "Pilsner")).toBe("Alles klar — Pilsner.");
    expect(waiterAckMessage("en", "Pilsner")).toBe("Got it — Pilsner.");
    expect(waiterAckMessage("sr", "Pilsner")).toBe("Razumem — Pilsner.");
    expect(waiterAckMessage("sr", "Pilsner")).not.toMatch(/korpu|cart/i);
  });

  it("cartAddedMessage aliases waiterAckMessage", () => {
    expect(cartAddedMessage("de", "Weizen")).toBe(waiterAckMessage("de", "Weizen"));
  });
});
