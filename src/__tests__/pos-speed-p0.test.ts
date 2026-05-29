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
    orderSource: "staff",
    ...overrides,
  };
}

describe("POS Speed P0", () => {
  it("buildOutboxEvents(created) does not enqueue fiscal.tse_sign (FC-2)", () => {
    const events = buildOutboxEvents(baseContext(), "created");
    const eventTypes = events.map((e) => e.event_type);

    expect(eventTypes).not.toContain("fiscal.tse_sign");
    expect(events.some((e) => e.domain === "fiscal")).toBe(false);
    expect(eventTypes).toContain("fulfill.notify_staff");
  });
});
