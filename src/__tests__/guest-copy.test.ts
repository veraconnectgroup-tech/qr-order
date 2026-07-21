import { describe, expect, it } from "vitest";
import {
  cartAddedMessage,
  clarifyModifierMessage,
  clarifyPaymentMessage,
  clarifyProductMessage,
  clarifySizeMessage,
  clarifySlotMessage,
  handoffWaitMessage,
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

  it("clarifySlotMessage routes each pending-slot kind to its own wording, not always payment", () => {
    expect(clarifySlotMessage("en", "serve_size")).toBe(clarifySizeMessage("en"));
    expect(clarifySlotMessage("en", "modifier")).toBe(clarifyModifierMessage("en"));
    expect(clarifySlotMessage("en", "product")).toBe(clarifyProductMessage("en"));
    expect(clarifySlotMessage("en", "payment_method")).toBe(clarifyPaymentMessage("en"));

    // Concretely: a size-pending slot must not ask about payment.
    const sizeFallback = clarifySlotMessage("en", "serve_size");
    expect(sizeFallback).not.toMatch(/pay|cash|card/i);
    expect(sizeFallback).toMatch(/size/i);
  });

  it("clarifySlotMessage defaults to payment wording when slot kind is unknown (preserves prior fallback)", () => {
    expect(clarifySlotMessage("en", undefined)).toBe(clarifyPaymentMessage("en"));
  });

  it("handoffWaitMessage differentiates payment handoff from the default waiter wording", () => {
    const waiterMsg = handoffWaitMessage("en");
    const paymentMsg = handoffWaitMessage("en", "payment");
    expect(waiterMsg).toBe("On my way — just a moment.");
    expect(paymentMsg).not.toBe(waiterMsg);
    expect(paymentMsg).toMatch(/payment/i);
  });

  it("handoffWaitMessage keeps the exact original string for the waiter case (safety-net regression guard)", () => {
    expect(handoffWaitMessage("de")).toBe("Bin gleich bei Ihnen — einen Moment.");
    expect(handoffWaitMessage("en")).toBe("On my way — just a moment.");
    expect(handoffWaitMessage("sr")).toBe("Na putu sam — samo trenutak.");
  });
});
