import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { DeliverectInboundAdapter } from "@/lib/pos/inbound/adapters/deliverect-inbound";
import { GenericInboundAdapter } from "@/lib/pos/inbound/adapters/generic-inbound";
import { verifyPosWebhookSignature } from "@/lib/pos/inbound/verify-signature";
import { buildOutboxEvents } from "@/lib/outbox/build-outbox-events";

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

  it("returns unknown for unrecognized payloads", () => {
    const event = adapter.parseEvent({ ping: true }, new Headers());

    expect(event.type).toBe("unknown");
    if (event.type !== "unknown") return;
    expect(event.rawEventType).toBeUndefined();
  });

  it("returns unknown with rawEventType when event field is present", () => {
    const event = adapter.parseEvent(
      { event: "menu.updated", data: {} },
      new Headers()
    );

    expect(event.type).toBe("unknown");
    if (event.type !== "unknown") return;
    expect(event.rawEventType).toBe("menu.updated");
  });

  it("rejects order.created without externalOrderId", () => {
    const event = adapter.parseEvent(
      {
        event: "order.created",
        items: [{ name: "Espresso", quantity: 1, unitPrice: 3.5, total: 3.5 }],
      },
      new Headers()
    );

    expect(event.type).toBe("reject");
    if (event.type !== "reject") return;
    expect(event.reason).toContain("externalOrderId");
  });

  it("rejects order.created without items", () => {
    const event = adapter.parseEvent(
      {
        event: "order.created",
        externalOrderId: "POS-empty",
        total: 0,
      },
      new Headers()
    );

    expect(event.type).toBe("reject");
    if (event.type !== "reject") return;
    expect(event.reason).toContain("item");
  });

  it("parses order.cancelled events", () => {
    const event = adapter.parseEvent(
      {
        event: "order.cancelled",
        externalOrderId: "POS-999",
      },
      new Headers()
    );

    expect(event.type).toBe("order.cancelled");
    if (event.type !== "order.cancelled") return;
    expect(event.externalOrderId).toBe("POS-999");
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

describe("DeliverectInboundAdapter", () => {
  const adapter = new DeliverectInboundAdapter();

  it("parses Deliverect POS order payload with cents and subItems", () => {
    const event = adapter.parseEvent(
      {
        _id: "deliv-order-abc",
        tableNumber: "T12",
        orderIsAlreadyPaid: false,
        payment: { amount: 2550, type: 0 },
        items: [
          {
            name: "Burger",
            quantity: 1,
            price: 1200,
            subItems: [{ name: "Extra cheese", price: 150 }],
          },
          {
            name: "Cola",
            quantity: 2,
            price: 600,
          },
        ],
      },
      new Headers()
    );

    expect(event.type).toBe("order.created");
    if (event.type !== "order.created") return;

    expect(event.order.externalOrderId).toBe("deliv-order-abc");
    expect(event.order.tableName).toBe("T12");
    expect(event.order.total).toBe(25.5);
    expect(event.order.items).toHaveLength(2);
    expect(event.order.items[0]?.unitPrice).toBe(12);
    expect(event.order.items[0]?.modifiers).toEqual([
      { name: "Extra cheese", price: 1.5 },
    ]);
    expect(event.order.paymentState).toBe("UNPAID");
  });

  it("uses _id over Vera channelOrderId UUID for external order id", () => {
    const event = adapter.parseEvent(
      {
        _id: "pos-local-99",
        channelOrderId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [{ name: "Water", quantity: 1, price: 300 }],
      },
      new Headers()
    );

    expect(event.type).toBe("order.created");
    if (event.type !== "order.created") return;
    expect(event.order.externalOrderId).toBe("pos-local-99");
  });
});

describe("POS inbound anti-loop", () => {
  it("does not enqueue fulfill.push_pos for pos-origin orders", () => {
    const events = buildOutboxEvents(
      {
        orderId: "order-1",
        locationId: "loc-1",
        orgId: "org-1",
        orderNumber: 42,
        tableName: "Table 5",
        total: 10,
        paymentStatus: "pending",
        orderSource: "pos",
        posIntegration: {
          id: "pi-1",
          provider: "deliverect",
          status: "connected",
        },
        cloudPrinters: [],
        activeWebhooks: [],
      },
      "created"
    );

    expect(events.some((e) => e.event_type === "fulfill.push_pos")).toBe(false);
    expect(events.some((e) => e.event_type === "fulfill.notify_staff")).toBe(
      true
    );
  });
});
