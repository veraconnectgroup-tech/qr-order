import { describe, expect, it } from "vitest";
import {
  DENIS_EXTENDED_WEBHOOK_EVENTS,
  extendedWebhookPayloadHasNoPii,
  type OrderSubmittedData,
} from "@/lib/webhooks/extended-webhook-types";
import {
  DENIS_OPERATOR_WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks/events";
import {
  WEBHOOK_ORG_RATE_LIMIT,
  checkWebhookOrgRateLimit,
} from "@/lib/webhooks/webhook-rate-limit";

describe("denis extended webhook events W1", () => {
  it("registers all Layer 7 operational events", () => {
    for (const event of DENIS_EXTENDED_WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENTS).toContain(event);
      expect(WEBHOOK_EVENT_LABELS[event]).toBeTruthy();
    }
    expect(DENIS_EXTENDED_WEBHOOK_EVENTS).toContain("denis.order.submitted");
    expect(DENIS_EXTENDED_WEBHOOK_EVENTS).toContain("denis.staff.alert");
  });

  it("keeps legacy denis operator events registered", () => {
    for (const event of DENIS_OPERATOR_WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENTS).toContain(event);
    }
  });

  it("builds order submitted payload without PII", () => {
    const data: OrderSubmittedData = {
      orderId: "ord_789",
      orderNumber: 42,
      tableId: "tbl_012",
      tableName: "Sto 4",
      items: [
        { productId: "p_1", name: "Ćevapi", quantity: 2, price: 850 },
        { productId: "p_2", name: "Pivo", quantity: 3, price: 350 },
      ],
      total: 2750,
      guestLanguage: "sr",
      isReturningGuest: true,
      allergyFlags: ["orašasti"],
    };

    const envelope = {
      event: "denis.order.submitted",
      timestamp: "2026-06-27T14:32:00Z",
      orgId: "org_123",
      locationId: "loc_456",
      data,
    };

    expect(envelope.data.items).toHaveLength(2);
    expect(envelope.data.total).toBe(2750);
    expect(extendedWebhookPayloadHasNoPii(envelope)).toBe(true);
  });

  it("blocks payloads with guest PII keys", () => {
    expect(
      extendedWebhookPayloadHasNoPii({
        data: { guest_name: "Marko" },
      })
    ).toBe(false);
  });

  it("enforces org webhook rate limit bucket", () => {
    const orgId = `test-org-${Date.now()}`;
    for (let i = 0; i < WEBHOOK_ORG_RATE_LIMIT; i += 1) {
      expect(checkWebhookOrgRateLimit(orgId)).toBe(true);
    }
    expect(checkWebhookOrgRateLimit(orgId)).toBe(false);
  });
});
