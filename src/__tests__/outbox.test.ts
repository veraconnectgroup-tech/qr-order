import { describe, expect, it } from "vitest";
import { buildOutboxEvents } from "@/lib/outbox/build-outbox-events";
import type { OrderOutboxContext } from "@/lib/outbox/types";

function baseContext(
  overrides: Partial<OrderOutboxContext> = {}
): OrderOutboxContext {
  return {
    orderId: "order-1",
    locationId: "loc-1",
    orgId: "org-1",
    orderNumber: 42,
    tableName: "Table 5",
    total: 19.9,
    paymentStatus: "pending",
    posIntegration: null,
    cloudPrinters: [],
    activeWebhooks: [],
    ...overrides,
  };
}

describe("buildOutboxEvents", () => {
  it("returns no outbox rows for approval_requested phase", () => {
    const events = buildOutboxEvents(baseContext(), "approval_requested");
    expect(events).toEqual([]);
  });

  it("does not enqueue fiscal events on order create (FC-2: TSE at payment)", () => {
    const events = buildOutboxEvents(
      baseContext({ guestEmail: "guest@example.com" }),
      "created"
    );
    expect(events.map((e) => e.event_type)).toEqual(["fulfill.notify_staff"]);
    expect(events.some((e) => e.domain === "fiscal")).toBe(false);
  });

  it("skips fulfill.push_pos for pos-origin orders", () => {
    const events = buildOutboxEvents(
      baseContext({
        orderSource: "pos",
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
      }),
      "created"
    );

    expect(events.map((e) => e.event_type)).toEqual(["fulfill.notify_staff"]);
  });

  it("skips fiscal events in vorsystem mode and adds fulfill.push_pos", () => {
    const events = buildOutboxEvents(
      baseContext({
        posIntegration: {
          id: "pos-1",
          provider: "deliverect",
          status: "connected",
        },
        paymentStatus: "paid",
      }),
      "created"
    );

    expect(events.map((e) => e.event_type)).toEqual([
      "fulfill.notify_staff",
      "fulfill.push_pos",
    ]);

    const posEvent = events.find((e) => e.event_type === "fulfill.push_pos");
    expect(posEvent?.payload.paymentState).toBe("PAID");
  });

  it("adds integration.webhook per active webhook config", () => {
    const events = buildOutboxEvents(
      baseContext({
        activeWebhooks: [
          { id: "wh-1", url: "https://example.com/hook" },
          { id: "wh-2", url: "https://example.com/hook2" },
        ],
      }),
      "approved"
    );

    const webhookEvents = events.filter(
      (e) => e.event_type === "integration.webhook"
    );
    expect(webhookEvents).toHaveLength(2);
    expect(webhookEvents[0]?.payload.webhookConfigId).toBe("wh-1");
  });

  it("adds fulfill.cloud_print for auto-print cloud printers", () => {
    const events = buildOutboxEvents(
      baseContext({
        cloudPrinters: [
          { id: "cp-1", provider: "star_cloudprnt", autoPrint: true },
          { id: "cp-2", provider: "star_cloudprnt", autoPrint: false },
        ],
      }),
      "created"
    );

    expect(
      events.filter((e) => e.event_type === "fulfill.cloud_print")
    ).toHaveLength(1);
  });
});

describe("computeOutboxRetryDelaySeconds", () => {
  it("applies exponential backoff capped at 300s", async () => {
    const { computeOutboxRetryDelaySeconds } = await import(
      "@/lib/outbox/retry-delay"
    );
    expect(computeOutboxRetryDelaySeconds(0)).toBe(5);
    expect(computeOutboxRetryDelaySeconds(1)).toBe(10);
    expect(computeOutboxRetryDelaySeconds(2)).toBe(20);
    expect(computeOutboxRetryDelaySeconds(10)).toBe(300);
  });
});

describe("getOutboxHandler", () => {
  it("resolves known event types", async () => {
    const { getOutboxHandler } = await import(
      "@/lib/outbox/handlers/registry"
    );
    expect(getOutboxHandler("fulfill.notify_staff")).toBeDefined();
    expect(getOutboxHandler("fulfill.push_pos")).toBeDefined();
    expect(getOutboxHandler("session.paid_online")).toBeDefined();
    expect(getOutboxHandler("fiscal.tse_sign")).toBeDefined();
    expect(getOutboxHandler("fiscal.beleg")).toBeDefined();
    expect(getOutboxHandler("unknown.event")).toBeUndefined();
  });
});
