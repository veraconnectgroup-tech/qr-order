import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  denisSessionUpdatedMetricsSchema,
  validateDenisSessionUpdatedPayload,
} from "@/lib/integrations/webhooks/denis-session-updated.schema";
import { handleIntegrationWebhook } from "@/lib/outbox/handlers/integration-webhook";
import {
  buildDenisOperatorWebhookData,
  DENIS_WEBHOOK_API_VERSION,
  denisOperatorPayloadHasNoPii,
} from "@/lib/webhooks/denis-operator-payload";
import * as webhookDispatch from "@/lib/webhooks/dispatch";
import { DENIS_OPERATOR_WEBHOOK_EVENTS } from "@/lib/webhooks/events";

const fixturePath = join(
  process.cwd(),
  "src/lib/integrations/fixtures/webhooks/denis.session.updated.v1.json"
);

describe("denis.session.updated webhook contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers denis.session.updated in operator webhook events", () => {
    expect(DENIS_OPERATOR_WEBHOOK_EVENTS).toContain("denis.session.updated");
  });

  it("validates golden fixture v1", () => {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;
    const parsed = validateDenisSessionUpdatedPayload(fixture);

    expect(parsed.apiVersion).toBe(DENIS_WEBHOOK_API_VERSION);
    expect(parsed.metrics.updateReason).toBe("turn_complete");
    expect(parsed.metrics.turnCount).toBe(3);
    expect(denisOperatorPayloadHasNoPii(parsed)).toBe(true);
  });

  it("builds outbox delivery payload with versioned apiVersion", () => {
    const built = buildDenisOperatorWebhookData({
      orgId: "11111111-1111-4111-8111-111111111111",
      locationId: "22222222-2222-4222-8222-222222222222",
      sessionId: "33333333-3333-4333-8333-333333333333",
      outcome: "active",
      metrics: {
        updateReason: "turn_complete",
        status: "active",
        outcome: "active",
        ordersCount: 0,
        turnCount: 1,
      },
      traceId: "trace-1",
      created_at: "2026-06-07T14:30:00.000Z",
    });

    const deliveryPayload = {
      ...built,
      apiVersion: DENIS_WEBHOOK_API_VERSION,
    };

    expect(() => validateDenisSessionUpdatedPayload(deliveryPayload)).not.toThrow();
  });

  it("rejects metrics missing required fields", () => {
    const result = denisSessionUpdatedMetricsSchema.safeParse({
      updateReason: "turn_complete",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("maps denis.session.updated through integration.webhook outbox handler", async () => {
    const deliver = vi
      .spyOn(webhookDispatch, "deliverOrgWebhookToConfig")
      .mockResolvedValue(undefined);

    await handleIntegrationWebhook({
      orgId: "11111111-1111-4111-8111-111111111111",
      webhookConfigId: "wh-1",
      webhookEvent: "denis.session.updated",
      locationId: "22222222-2222-4222-8222-222222222222",
      sessionId: "33333333-3333-4333-8333-333333333333",
      outcome: "active",
      metrics: {
        updateReason: "order_submitted",
        status: "active",
        outcome: "active",
        ordersCount: 1,
        turnCount: 4,
      },
      traceId: "trace-abc",
      created_at: "2026-06-07T14:30:00.000Z",
    });

    expect(deliver).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "wh-1",
      "denis.session.updated",
      expect.objectContaining({
        apiVersion: DENIS_WEBHOOK_API_VERSION,
        sessionId: "33333333-3333-4333-8333-333333333333",
        metrics: expect.objectContaining({
          updateReason: "order_submitted",
          ordersCount: 1,
        }),
      })
    );
  });
});
