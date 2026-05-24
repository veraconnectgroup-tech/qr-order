import { logger } from "@/lib/logger";
import { deliverOrgWebhookToConfig } from "@/lib/webhooks/dispatch";
import type { WebhookEvent } from "@/lib/webhooks/events";

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

  const data: Record<string, unknown> = {
    order_id: payload.orderId,
    order_number: payload.orderNumber,
    location_id: payload.locationId,
    total: payload.total,
    source: payload.orderSource ?? "qr",
  };

  await deliverOrgWebhookToConfig(orgId, webhookConfigId, event, data);

  logger.info("Outbox integration.webhook delivered", {
    orgId,
    webhookConfigId,
    event,
    orderId: payload.orderId,
  });
}
