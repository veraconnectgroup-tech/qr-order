import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import type { OutboxDomain, OutboxEventType } from "@/lib/outbox/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OutboxEventRow } from "@/lib/outbox/processor";

export type DeadLetterQueueRow = {
  id: string;
  org_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type DlqPayloadEnvelope = {
  outboxPayload?: Record<string, unknown>;
  aggregateId?: string;
  domain?: OutboxDomain;
  outboxEventId?: string;
};

async function resolveOrgIdForOrder(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string
): Promise<string | null> {
  const { data: order } = await admin
    .from("orders")
    .select("location_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", (order as { location_id: string }).location_id)
    .maybeSingle();

  return (location as { org_id: string } | null)?.org_id ?? null;
}

export async function moveToDeadLetterQueue(
  admin: ReturnType<typeof createAdminClient>,
  event: OutboxEventRow,
  errorMessage: string
): Promise<void> {
  const aggregateId =
    typeof event.aggregate_id === "string" ? event.aggregate_id : "";
  const orgId = aggregateId ? await resolveOrgIdForOrder(admin, aggregateId) : null;

  if (!orgId) {
    logger.error("DLQ insert skipped — could not resolve org_id", {
      outboxId: event.id,
      aggregateId,
      eventType: event.event_type,
    });
    return;
  }

  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : {};

  const { error } = await admin.from("dead_letter_queue" as never).insert({
    org_id: orgId,
    job_type: event.event_type,
    payload: {
      outboxPayload: payload,
      aggregateId: event.aggregate_id,
      domain: event.domain,
      outboxEventId: event.id,
    },
    error_message: errorMessage.slice(0, 2000),
    attempts: event.attempts,
    max_attempts: event.max_attempts,
  } as never);

  if (error) {
    logger.error("dead_letter_queue insert failed", {
      outboxId: event.id,
      error: error.message,
    });
    return;
  }

  logger.warn("Outbox job moved to dead letter queue", {
    outboxId: event.id,
    orgId,
    jobType: event.event_type,
    error: errorMessage,
  });
}

export async function countUnresolvedDlq(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("dead_letter_queue" as never)
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);

  if (error) {
    logger.warn("DLQ count failed", { error: error.message });
    return 0;
  }

  return count ?? 0;
}

export async function loadOrgDeadLetterQueue(
  orgId: string
): Promise<DeadLetterQueueRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dead_letter_queue" as never)
    .select("*")
    .eq("org_id", orgId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("DLQ org load failed", { orgId, error: error.message });
    return [];
  }

  return (data ?? []) as unknown as DeadLetterQueueRow[];
}

export async function retryDeadLetterQueueItem(
  dlqId: string,
  resolvedByUserId: string
): Promise<{ error?: string; orgId?: string }> {
  const admin = createAdminClient();

  const { data: row, error: loadError } = await admin
    .from("dead_letter_queue" as never)
    .select("*")
    .eq("id", dlqId)
    .is("resolved_at", null)
    .maybeSingle();

  if (loadError || !row) {
    return { error: loadError?.message ?? "Failed job not found." };
  }

  const dlq = row as unknown as DeadLetterQueueRow;
  const envelope = dlq.payload as DlqPayloadEnvelope;
  const outboxPayload = envelope.outboxPayload ?? {};
  const aggregateId = envelope.aggregateId ?? dlq.payload.orderId;
  const domain = envelope.domain;
  const eventType = dlq.job_type as OutboxEventType;

  if (!aggregateId || !domain) {
    return { error: "DLQ payload is missing retry metadata." };
  }

  await enqueueOutboxEvents(admin, [
    {
      aggregate_id: String(aggregateId),
      domain,
      event_type: eventType,
      payload: outboxPayload,
    },
  ]);

  const { error: updateError } = await admin
    .from("dead_letter_queue" as never)
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedByUserId,
    } as never)
    .eq("id", dlqId);

  if (updateError) {
    return { error: updateError.message };
  }

  logger.info("DLQ item retried", { dlqId, jobType: dlq.job_type });
  return { orgId: dlq.org_id };
}
