import { describe, expect, it } from "vitest";
import {
  classifyGuestRecoveryIntent,
  openOrderStatusGuestMessage,
  resolveGuestRecoveryResponse,
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
  it("classifies payment and status intents", () => {
    expect(classifyGuestRecoveryIntent("Mogu li da platim?")).toBe("payment");
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

  it("answers status locally from scene situation", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Kad stiže moj burger?",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local?.answeredLocally).toBe(true);
    expect(local?.message).toContain("5");
    expect(local?.message).toContain("Chicken Burger");
    expect(local?.quickReplies).toContain("Platiti");
  });

  it("auto-calls waiter when guest cannot reach staff", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Ne mogu da pozovem konobara",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local?.action?.tryWaiterCall).toBe(true);
    expect(local?.message.toLowerCase()).toMatch(/putu|trenutak/);
  });

  it("offers payment chips locally when bill exists", () => {
    const local = tryLocalGuestAnswer({
      guestMessage: "Mogu li da platim?",
      language: "sr",
      situation: preparingSituation,
      cartItemCount: 0,
    });
    expect(local?.quickReplies).toEqual(["Kes", "Kartica", "Online"]);
    expect(local?.message.toLowerCase()).toContain("plać");
  });
});
