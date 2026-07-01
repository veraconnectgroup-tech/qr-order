import { describe, expect, it } from "vitest";
import {
  detectStornoCopilotSignal,
  formatStornoCopilotMessage,
  guestRequestedStorno,
} from "@/lib/fiscal/storno-copilot";

const baseOrder = {
  orderId: "order-1",
  orderNumber: 42,
  tseSigned: true,
  hasStorno: false,
  paymentMethod: "online",
  total: 24.5,
};

describe("storno-copilot", () => {
  it("detects guest cancel request and formats staff suggestion", () => {
    expect(guestRequestedStorno("Molim storno porudžbine")).toBe(true);

    const signal = detectStornoCopilotSignal({
      recentGuestMessages: ["Molim storno porudžbine"],
      sessionOrder: baseOrder,
    });

    expect(signal?.source).toBe("guest_cancel");
    expect(signal?.orderNumber).toBe(42);

    const message = formatStornoCopilotMessage(signal!, "7");
    expect(message).toContain("predloži storno #42");
    expect(message).toContain("Sto 7");
  });

  it("does not suggest storno when order already stornoed", () => {
    const signal = detectStornoCopilotSignal({
      recentGuestMessages: ["Storno molim"],
      sessionOrder: { ...baseOrder, hasStorno: true },
    });

    expect(signal).toBeNull();
  });

  it("does not suggest storno without TSE signature", () => {
    const signal = detectStornoCopilotSignal({
      recentGuestMessages: ["Cancel order"],
      sessionOrder: { ...baseOrder, tseSigned: false },
    });

    expect(signal).toBeNull();
  });
});
