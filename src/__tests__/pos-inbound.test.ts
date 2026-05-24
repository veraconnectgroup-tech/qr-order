import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { GenericInboundAdapter } from "@/lib/pos/inbound/adapters/generic-inbound";
import { verifyPosWebhookSignature } from "@/lib/pos/inbound/verify-signature";

describe("GenericInboundAdapter", () => {
  const adapter = new GenericInboundAdapter();

  it("parses a minimal order.created payload", () => {
    const event = adapter.parseEvent(
      {
        event: "order.created",
        externalOrderId: "POS-123",
        tableName: "Table 5",
        total: 25.5,
        subtotal: 21.43,
        taxAmount: 4.07,
        paymentState: "UNPAID",
        items: [
          { name: "Espresso", quantity: 2, unitPrice: 3.5, total: 7 },
          { name: "Croissant", quantity: 1, unitPrice: 14.43, total: 14.43 },
        ],
      },
      new Headers()
    );

    expect(event.type).toBe("order.created");
    if (event.type !== "order.created") return;

    expect(event.order.externalOrderId).toBe("POS-123");
    expect(event.order.tableName).toBe("Table 5");
    expect(event.order.items).toHaveLength(2);
    expect(event.order.paymentState).toBe("UNPAID");
  });

  it("parses table.closed events", () => {
    const event = adapter.parseEvent(
      {
        event: "table.closed",
        tableName: "Table 5",
        settlement: "paid_at_pos",
      },
      new Headers()
    );

    expect(event.type).toBe("table.closed");
    if (event.type !== "table.closed") return;
    expect(event.table.settlement).toBe("paid_at_pos");
  });
});

describe("verifyPosWebhookSignature", () => {
  it("validates sha256 HMAC signatures", () => {
    const secret = "test-secret";
    const body = JSON.stringify({ hello: "world" });
    const sig = createHmac("sha256", secret).update(body).digest("hex");

    const headers = new Headers({ "x-vera-signature": `sha256=${sig}` });
    expect(verifyPosWebhookSignature(body, headers, secret)).toBe(true);
    expect(verifyPosWebhookSignature(body, headers, "wrong")).toBe(false);
  });
});
