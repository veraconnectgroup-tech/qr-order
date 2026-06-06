import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import {
  buildDenisOperatorWebhookData,
  type DenisOperatorWebhookPayload,
} from "@/lib/webhooks/denis-operator-payload";
import type { DenisOperatorWebhookEvent } from "@/lib/webhooks/events";

async function loadWebhooksForEvent(
  admin: SupabaseClient,
  orgId: string,
  event: DenisOperatorWebhookEvent
): Promise<Array<{ id: string }>> {
  const { data, error } = await admin
    .from("webhook_configs")
    .select("id, events")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    logger.warn("Denis operator webhook lookup failed", {
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

/** Single emit path for denis.* operator webhooks (outbox only). */
export async function enqueueDenisOperatorWebhooks(
  admin: SupabaseClient,
  input: {
    orgId: string;
    event: DenisOperatorWebhookEvent;
    aggregateId: string;
    payload: Omit<DenisOperatorWebhookPayload, "created_at">;
  }
): Promise<number> {
  const webhooks = await loadWebhooksForEvent(admin, input.orgId, input.event);
  if (!webhooks.length) return 0;

  const data = buildDenisOperatorWebhookData(input.payload);

  const events = webhooks.map((webhook) => ({
    aggregate_type: "session" as const,
    aggregate_id: input.aggregateId,
    domain: "integration" as const,
    event_type: "integration.webhook" as const,
    payload: {
      orgId: input.orgId,
      webhookConfigId: webhook.id,
      webhookEvent: input.event,
      locationId: data.locationId,
      sessionId: data.sessionId,
      outcome: data.outcome,
      metrics: data.metrics,
      traceId: data.traceId,
      proposalId: data.proposalId,
      created_at: data.created_at,
    },
  }));

  return enqueueOutboxEvents(admin, events);
}
