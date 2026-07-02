import { describe, expect, it } from "vitest";
import {
  classifyGuestRecoveryIntent,
  openOrderStatusGuestMessage,
  paymentRecoveryQuickReplies,
  resolveGuestRecoveryResponse,
  resolveIntentRecoveryTier,
  tryLocalGuestAnswer,
} from "@/lib/guest/denis-guest-recovery";
import type { SceneSituation } from "@/lib/scene/types";

const preparingSituation: SceneSituation = {
  headline: "Porudžbina #5 u pripremi",
  orders: [
    {
      orderId: "o1",
      orderNumber: 5,
      status: "preparing",
      itemsLabel: "Chicken Burger",
      prepMinutes: 12,
      paymentStatus: "pending",
      primaryAction: { kind: "open_order", orderId: "o1" },
    },
  ],
  hasReadyOrder: false,
  hasActiveKitchen: true,
};

describe("denis guest recovery ladder", () => {
  it("classifies payment, bill amount, and status intents", () => {
    expect(classifyGuestRecoveryIntent("Mogu li da platim?")).toBe("payment");
    expect(classifyGuestRecoveryIntent("Koliki mi je račun?")).toBe("bill_amount");
    expect(classifyGuestRecoveryIntent("htao sam da mi kazes koliki mi je racun")).toBe(
      "bill_amount"
    );
    expect(classifyGuestRecoveryIntent("Kad stiže moj burger?")).toBe("status");
    expect(classifyGuestRecoveryIntent("Ne mogu da pozovem konobara")).toBe(
      "waiter"
    );
  });

  it("escalates from contextual retry to waiter handoff", () => {
    const tier0 = resolveGuestRecoveryResponse({
      guestMessage: "Mogu li da platim?",
      failureCount: 1,
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(tier0.tier).toBe(0);
    expect(tier0.message.toLowerCase()).toContain("plać");

    const tier2 = resolveGuestRecoveryResponse({
      guestMessage: "Kad stiže burger?",
      failureCount: 3,
      language: "sr",
      situation: preparingSituation,
    });
    expect(tier2.tier).toBe(2);
    expect(tier2.message.toLowerCase()).toContain("konobar");
    expect(tier2.action?.tryWaiterCall).toBe(true);
  });

  it("formats live order status from fold orders", () => {
    const message = openOrderStatusGuestMessage(
      [
        {
          id: "o1",
          orderNumber: 5,
          status: "preparing",
          paymentStatus: "pending",
          estimatedPrepMinutes: 12,
          createdAt: new Date().toISOString(),
          items: [{ productName: "Chicken Burger", quantity: 1 }],
        },
      ],
      "sr"
    );
    expect(message).toContain("5");
    expect(message).toContain("Chicken Burger");
  });

  it("does not answer locally — all guest chat goes through Denis LLM", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Kad stiže moj burger?",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it.skip("auto-calls waiter when guest cannot reach staff", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Ne mogu da pozovem konobara",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local?.action?.tryWaiterCall).toBe(true);
    expect(local?.message.toLowerCase()).toMatch(/putu|trenutak/);
  });

  it("routes payment and status to tier 0, bill/waiter to tier 1", () => {
    expect(resolveIntentRecoveryTier("payment")).toBe(0);
    expect(resolveIntentRecoveryTier("status")).toBe(0);
    expect(resolveIntentRecoveryTier("bill_amount")).toBe(1);
    expect(resolveIntentRecoveryTier("waiter")).toBe(1);
    expect(resolveIntentRecoveryTier("order")).toBe(2);
  });

  it("payment intent is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Mogu li da platim?",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it("cash payment is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Kes",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it("post-order settling is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "To je sve",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it("already-ordered reassurance is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Porucio sam već",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it("add-more chip is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Još nešto",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it("bill amount is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Koliki mi je račun?",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local).toBeNull();
  });

  it("cart total is not answered locally (Denis LLM only)", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Koliko je ukupno?",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 2,
      cartTotal: 24.5,
      currency: "EUR",
    });
    expect(local).toBeNull();
  });
});
