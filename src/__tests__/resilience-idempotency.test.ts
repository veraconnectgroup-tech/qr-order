import { describe, expect, it } from "vitest";
import {
  buildGuestOrderIdempotencyKey,
  buildPaymentIdempotencyKey,
} from "@/lib/resilience/idempotency";

describe("resilience idempotency keys", () => {
  it("builds deterministic payment keys", () => {
    expect(buildPaymentIdempotencyKey("org-1", "order-1", 1250)).toBe(
      "pay:org-1:order-1:1250"
    );
  });

  it("builds deterministic guest order keys", () => {
    const items = [
      {
        productId: "p1",
        quantity: 2,
        modifiers: [{ modifierId: "m1" }],
      },
    ];
    const keyA = buildGuestOrderIdempotencyKey("session-1", items);
    const keyB = buildGuestOrderIdempotencyKey("session-1", items);
    expect(keyA).toBe(keyB);
    expect(keyA.startsWith("order:session-1:")).toBe(true);
  });
});
