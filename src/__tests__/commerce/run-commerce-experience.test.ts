import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
  COMMERCE_OUTBOX_TYPES,
} from "@/lib/commerce/event-types";
import {
  commerceIdempotencyKey,
  resolveCommerceIntent,
} from "@/lib/commerce/runtime/resolve-commerce-intent";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";

describe("commerce experience spine (ADR-014 CE-1)", () => {
  it("defines stable command and event type constants", () => {
    expect(COMMERCE_COMMAND_TYPES.recordPaymentSettled).toBe(
      "RecordPaymentSettled"
    );
    expect(COMMERCE_EVENT_TYPES.paymentSettled).toBe("payment.settled");
    expect(COMMERCE_OUTBOX_TYPES.projectionRefresh).toBe(
      "commerce.projection.refresh"
    );
  });

  it("resolves payment_settled intent when order is paid", () => {
    const intent = resolveCommerceIntent(
      { kind: "payment_settled", orderId: "order-1" },
      {
        paymentStatus: "paid",
        paymentMethod: "card",
        amountCents: 2550,
        orderId: "order-1",
      }
    );

    expect(intent).toEqual({
      type: "emit",
      commandType: "RecordPaymentSettled",
      eventType: "payment.settled",
      payload: {
        orderId: "order-1",
        amountCents: 2550,
        paymentMethod: "card",
      },
    });
  });

  it("skips payment_settled when order is not paid", () => {
    const intent = resolveCommerceIntent(
      { kind: "payment_settled", orderId: "order-1" },
      {
        paymentStatus: "pending",
        paymentMethod: "card",
        amountCents: 2550,
        orderId: "order-1",
      }
    );

    expect(intent).toEqual({ type: "none", reason: "not_paid" });
  });

  it("builds stable idempotency keys per trigger", () => {
    expect(
      commerceIdempotencyKey(
        { kind: "payment_settled", orderId: "abc" },
        {}
      )
    ).toBe("payment_settled:abc");

    expect(
      commerceIdempotencyKey(
        { kind: "session_bill_settled", sessionId: "sess-1" },
        {}
      )
    ).toBe("session_bill_settled:sess-1");
  });

  it("resolves order_delivered intent", () => {
    const intent = resolveCommerceIntent(
      { kind: "order_delivered", orderId: "order-2" },
      {
        paymentStatus: "paid",
        paymentMethod: "cash",
        amountCents: 1000,
        orderId: "order-2",
      }
    );

    expect(intent).toEqual({
      type: "emit",
      commandType: COMMERCE_COMMAND_TYPES.recordOrderDelivered,
      eventType: COMMERCE_EVENT_TYPES.orderDelivered,
      payload: { orderId: "order-2" },
    });
  });
});
