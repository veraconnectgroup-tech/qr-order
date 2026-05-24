import { describe, expect, it, vi } from "vitest";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { markSessionOrdersPaidOnline } from "@/lib/orders/mark-session-paid-online";
import * as enqueueModule from "@/lib/outbox/enqueue-events";

describe("isPaidPaymentStatus", () => {
  it("treats paid and pos_online as settled", () => {
    expect(isPaidPaymentStatus("paid")).toBe(true);
    expect(isPaidPaymentStatus("pos_online")).toBe(true);
  });

  it("treats pending and processing as unpaid", () => {
    expect(isPaidPaymentStatus("pending")).toBe(false);
    expect(isPaidPaymentStatus("processing")).toBe(false);
  });
});

describe("markSessionOrdersPaidOnline", () => {
  it("marks POS orders pos_online and enqueues session.paid_online", async () => {
    const orderUpdates: Array<Record<string, unknown>> = [];
    const outboxEvents: Array<Record<string, unknown>> = [];

    const admin = {
      from(table: string) {
        if (table === "orders") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { id: "order-pos", order_source: "pos" },
                  { id: "order-qr", order_source: "qr" },
                ],
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              orderUpdates.push(payload);
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === "session_payment_intents") {
          return {
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "pos_integrations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "pi-1",
                      provider: "deliverect",
                      status: "connected",
                    },
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const enqueueSpy = vi
      .spyOn(enqueueModule, "enqueueOutboxEvents")
      .mockImplementation(async (_admin, events) => {
        outboxEvents.push(...events);
        return events.length;
      });

    try {
      await markSessionOrdersPaidOnline(admin as never, {
        sessionId: "sess-1",
        locationId: "loc-1",
        orgId: "org-1",
        paymentIntentId: "pi_stripe",
        amountCents: 5000,
        orderIds: ["order-pos", "order-qr"],
      });
    } finally {
      enqueueSpy.mockRestore();
    }

    expect(orderUpdates).toContainEqual({
      payment_status: "pos_online",
      payment_method: "pos_online",
    });
    expect(orderUpdates).toContainEqual({
      payment_status: "paid",
      payment_method: "online",
    });

    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0]).toMatchObject({
      aggregate_type: "session",
      aggregate_id: "sess-1",
      domain: "session",
      event_type: "session.paid_online",
    });
  });

  it("skips POS notify when session has no POS orders", async () => {
    const enqueueSpy = vi
      .spyOn(enqueueModule, "enqueueOutboxEvents")
      .mockResolvedValue(0);

    const admin = {
      from(table: string) {
        if (table === "orders") {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: "order-qr", order_source: "qr" }],
              }),
            }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "session_payment_intents") {
          return {
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    try {
      await markSessionOrdersPaidOnline(admin as never, {
        sessionId: "sess-1",
        locationId: "loc-1",
        orgId: "org-1",
        paymentIntentId: "pi_stripe",
        amountCents: 2500,
        orderIds: ["order-qr"],
      });
    } finally {
      enqueueSpy.mockRestore();
    }

    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});
