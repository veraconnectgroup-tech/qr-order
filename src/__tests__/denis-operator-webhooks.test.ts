import { describe, expect, it } from "vitest";
import {
  buildDenisOperatorWebhookData,
  denisOperatorPayloadHasNoPii,
} from "@/lib/webhooks/denis-operator-payload";
import {
  DENIS_OPERATOR_WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks/events";

describe("denis operator webhook events", () => {
  it("registers all ADR-028 denis.* events", () => {
    for (const event of DENIS_OPERATOR_WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENTS).toContain(event);
      expect(WEBHOOK_EVENT_LABELS[event]).toBeTruthy();
    }
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.session.updated");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.session.completed");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.session.converted");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.metrics.daily_ready");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.alert.conversion_drop");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.alert.credit_low");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.alert.circuit_open");
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.config.proposal.created");
  });
});

describe("denis operator webhook payload", () => {
  it("builds minimum contract shape without guest PII", () => {
    const payload = buildDenisOperatorWebhookData({
      orgId: "org-1",
      locationId: "loc-1",
      sessionId: "sess-1",
      outcome: "ordered",
      metrics: { conversionRate: 0.42 },
      traceId: "trace-1",
    });

    expect(payload.orgId).toBe("org-1");
    expect(payload.locationId).toBe("loc-1");
    expect(payload.sessionId).toBe("sess-1");
    expect(payload.outcome).toBe("ordered");
    expect(payload.metrics).toEqual({ conversionRate: 0.42 });
    expect(payload.traceId).toBe("trace-1");
    expect(payload.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(denisOperatorPayloadHasNoPii(payload)).toBe(true);
  });

  it("rejects payloads containing forbidden PII keys", () => {
    const bad = buildDenisOperatorWebhookData({
      orgId: "org-1",
      locationId: "loc-1",
      metrics: { session_token: "secret" } as Record<string, unknown>,
    });
    expect(denisOperatorPayloadHasNoPii(bad)).toBe(false);
  });
});
