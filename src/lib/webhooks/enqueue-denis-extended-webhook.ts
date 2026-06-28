import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import type {
  DenisExtendedWebhookEvent,
  ExtendedWebhookPayload,
  WebhookDataMap,
} from "@/lib/webhooks/extended-webhook-types";
import { extendedWebhookPayloadHasNoPii } from "@/lib/webhooks/extended-webhook-types";
import { asRecord } from "@/lib/supabase/json";
import { checkWebhookOrgRateLimit } from "@/lib/webhooks/webhook-rate-limit";

const WEBHOOK_MAX_ATTEMPTS = 3;

async function loadWebhooksForEvent(
  admin: SupabaseClient,
  orgId: string,
  event: DenisExtendedWebhookEvent
): Promise<Array<{ id: string }>> {
  const { data, error } = await admin
    .from("webhook_configs")
    .select("id, events")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    logger.warn("Denis extended webhook lookup failed", {
      orgId,
      event,
      error: error.message,
    });
    return [];
  }

  return (data ?? [])
    .filter((row) => {
      const cfg = row as { events: string[] };
      return cfg.events.includes(event);
    })
    .map((row) => ({ id: (row as { id: string }).id }));
}

/** Enqueue rich Denis operational webhooks via outbox (3 retries, exponential backoff). */
export async function enqueueDenisExtendedWebhooks<
  T extends DenisExtendedWebhookEvent,
>(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    event: T;
    aggregateId: string;
    data: WebhookDataMap[T];
    timestamp?: string;
  }
): Promise<number> {
  if (!checkWebhookOrgRateLimit(input.orgId)) {
    logger.warn("Denis extended webhook rate limit exceeded", {
      orgId: input.orgId,
      event: input.event,
    });
    return 0;
  }

  const envelope: ExtendedWebhookPayload<T> = {
    event: input.event,
    timestamp: input.timestamp ?? new Date().toISOString(),
    orgId: input.orgId,
    locationId: input.locationId,
    data: input.data,
  };

  if (!extendedWebhookPayloadHasNoPii(asRecord(envelope))) {
    logger.error("Denis extended webhook blocked — PII detected", {
      event: input.event,
      orgId: input.orgId,
    });
    return 0;
  }

  const webhooks = await loadWebhooksForEvent(admin, input.orgId, input.event);
  if (!webhooks.length) return 0;

  const events = webhooks.map((webhook) => ({
    aggregate_type: "order" as const,
    aggregate_id: input.aggregateId,
    domain: "integration" as const,
    event_type: "integration.webhook" as const,
    max_attempts: WEBHOOK_MAX_ATTEMPTS,
    payload: {
      orgId: input.orgId,
      webhookConfigId: webhook.id,
      webhookEvent: input.event,
      locationId: input.locationId,
      extendedData: envelope.data,
      timestamp: envelope.timestamp,
    },
  }));

  return enqueueOutboxEvents(admin, events);
}
