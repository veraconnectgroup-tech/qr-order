import { logger } from "@/lib/logger";
import { deliverOrgWebhookToConfig } from "@/lib/webhooks/dispatch";
import {
  buildDenisOperatorWebhookData,
  DENIS_WEBHOOK_API_VERSION,
} from "@/lib/webhooks/denis-operator-payload";
import {
  isDenisOperatorWebhookEvent,
  type WebhookEvent,
} from "@/lib/webhooks/events";

function buildWebhookData(
  event: WebhookEvent,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (isDenisOperatorWebhookEvent(event)) {
    const denisData = buildDenisOperatorWebhookData({
      orgId: String(payload.orgId ?? ""),
      locationId: String(payload.locationId ?? ""),
      sessionId:
        typeof payload.sessionId === "string" ? payload.sessionId : undefined,
      outcome:
        typeof payload.outcome === "string"
          ? (payload.outcome as "ordered" | "abandoned" | "handoff" | "active")
          : undefined,
      metrics:
        payload.metrics && typeof payload.metrics === "object"
          ? (payload.metrics as Record<string, unknown>)
          : undefined,
      traceId:
        typeof payload.traceId === "string" ? payload.traceId : undefined,
      proposalId:
        typeof payload.proposalId === "string" ? payload.proposalId : undefined,
      created_at:
        typeof payload.created_at === "string"
          ? payload.created_at
          : undefined,
    });

    return {
      ...denisData,
      apiVersion: DENIS_WEBHOOK_API_VERSION,
    };
  }

  return {
    order_id: payload.orderId,
    order_number: payload.orderNumber,
    location_id: payload.locationId,
    total: payload.total,
    source: payload.orderSource ?? "qr",
  };
}

export async function handleIntegrationWebhook(
  payload: Record<string, unknown>
): Promise<void> {
  const orgId = payload.orgId;
  const webhookConfigId = payload.webhookConfigId;
  const webhookEvent = payload.webhookEvent;

  if (typeof orgId !== "string" || typeof webhookConfigId !== "string") {
    throw new Error("integration.webhook missing orgId or webhookConfigId");
  }

  const event = (
    typeof webhookEvent === "string" ? webhookEvent : "order.created"
  ) as WebhookEvent;

  const data = buildWebhookData(event, payload);

  await deliverOrgWebhookToConfig(orgId, webhookConfigId, event, data);

  logger.info("Outbox integration.webhook delivered", {
    orgId,
    webhookConfigId,
    event,
    orderId: payload.orderId,
    sessionId: payload.sessionId,
  });
}
