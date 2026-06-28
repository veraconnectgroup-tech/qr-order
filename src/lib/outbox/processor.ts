import { getOutboxHandler } from "@/lib/outbox/handlers/registry";
import { moveToDeadLetterQueue } from "@/lib/outbox/dead-letter-queue";
import { computeOutboxNextRetryAt } from "@/lib/outbox/retry-delay";
import type { OutboxHandlerMetric } from "@/lib/outbox/types";
import { criticalPath } from "@/lib/orders/critical-path-events";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type OutboxEventRow = Database["public"]["Tables"]["outbox_events"]["Row"];

export const OUTBOX_BATCH_SIZE = 50;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const METRICS_WINDOW_HOURS = 24;

export type OutboxHandlerMetricsSnapshot = Record<
  string,
  {
    processed: number;
    failed: number;
    deadLetter: number;
    totalLatencyMs: number;
  }
>;

export type ProcessOutboxResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  deadLetter: number;
  recoveredStale: number;
  handlerMetrics: OutboxHandlerMetricsSnapshot;
};

function emptyHandlerMetrics(): OutboxHandlerMetricsSnapshot {
  return {};
}

function recordHandlerMetric(
  metrics: OutboxHandlerMetricsSnapshot,
  eventType: string,
  outcome: "processed" | "failed" | "deadLetter",
  latencyMs: number
) {
  const row = metrics[eventType] ?? {
    processed: 0,
    failed: 0,
    deadLetter: 0,
    totalLatencyMs: 0,
  };

  if (outcome === "processed") {
    row.processed += 1;
    row.totalLatencyMs += latencyMs;
  } else if (outcome === "failed") {
    row.failed += 1;
  } else {
    row.deadLetter += 1;
  }

  metrics[eventType] = row;
}

export function snapshotToHandlerMetrics(
  snapshot: OutboxHandlerMetricsSnapshot
): OutboxHandlerMetric[] {
  return Object.entries(snapshot)
    .map(([eventType, row]) => {
      const attempts = row.processed + row.failed + row.deadLetter;
      const failureRate =
        attempts > 0
          ? Math.round(((row.failed + row.deadLetter) / attempts) * 1000) / 10
          : 0;
      const avgLatencyMs =
        row.processed > 0 ? Math.round(row.totalLatencyMs / row.processed) : 0;

      return {
        eventType,
        throughput: row.processed,
        failed: row.failed,
        deadLetter: row.deadLetter,
        failureRate,
        avgLatencyMs,
      };
    })
    .sort((a, b) => a.eventType.localeCompare(b.eventType));
}

async function recoverStaleProcessing(
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

  const { data, error } = await admin
    .from("outbox_events")
    .update({
      status: "pending",
      last_error: "processing timeout — recovered for retry",
    })
    .eq("status", "processing")
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    logger.warn("Outbox stale recovery failed", { error: error.message });
    return 0;
  }

  return (data ?? []).length;
}

async function completeOutboxEvent(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    id: string;
    success: boolean;
    error?: string;
    attempts: number;
  }
) {
  const nextRetryAt =
    input.success ? null : computeOutboxNextRetryAt(input.attempts).toISOString();

  const { error } = await admin.rpc("complete_outbox_event", {
    p_id: input.id,
    p_success: input.success,
    p_error: input.error ?? null,
    p_next_retry_at: nextRetryAt,
  });

  if (error) {
    logger.error("complete_outbox_event RPC failed", {
      outboxId: input.id,
      error: error.message,
    });
  }
}

export type ProcessClaimedOutboxOutcome = "succeeded" | "failed" | "deadLetter";

/** Process one claimed row — exported for unit tests. */
export async function processClaimedOutboxEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: OutboxEventRow,
  handlerMetrics: OutboxHandlerMetricsSnapshot
): Promise<ProcessClaimedOutboxOutcome> {
  const handler = getOutboxHandler(event.event_type);
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : {};
  const startedAt = Date.now();

  try {
    if (!handler) {
      throw new Error(`No handler for event_type: ${event.event_type}`);
    }

    await handler(payload);

    await completeOutboxEvent(admin, {
      id: event.id,
      success: true,
      attempts: event.attempts,
    });

    const durationMs = Date.now() - startedAt;
    recordHandlerMetric(handlerMetrics, event.event_type, "processed", durationMs);
    criticalPath.outboxProcessed({
      eventId: event.id,
      domain: event.domain,
      eventType: event.event_type,
      duration_ms: durationMs,
    });
    return "succeeded";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await completeOutboxEvent(admin, {
      id: event.id,
      success: false,
      error: message,
      attempts: event.attempts,
    });

    if (event.attempts >= event.max_attempts) {
      await moveToDeadLetterQueue(admin, event, message);
      recordHandlerMetric(handlerMetrics, event.event_type, "deadLetter", 0);
      criticalPath.outboxDeadLetter({
        eventId: event.id,
        totalAttempts: event.attempts,
      });
      logger.error("Outbox event dead-lettered", {
        outboxId: event.id,
        eventType: event.event_type,
        aggregateId: event.aggregate_id,
        error: message,
      });
      return "deadLetter";
    }

    recordHandlerMetric(handlerMetrics, event.event_type, "failed", 0);
    criticalPath.outboxFailed({
      eventId: event.id,
      attempts: event.attempts,
      maxAttempts: event.max_attempts,
      error: message,
    });
    logger.warn("Outbox event scheduled for retry", {
      outboxId: event.id,
      eventType: event.event_type,
      attempts: event.attempts,
      error: message,
    });
    return "failed";
  }
}

/** Rolling handler throughput / failure / latency for one org (last 24h). */
export async function loadOrgOutboxHandlerMetrics(
  orgId: string,
  hours = METRICS_WINDOW_HOURS
): Promise<OutboxHandlerMetric[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: locations, error: locError } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", orgId);

  if (locError || !locations?.length) {
    return [];
  }

  const locationIds = locations.map((row) => (row as { id: string }).id);

  const { data: orders, error: orderError } = await admin
    .from("orders")
    .select("id")
    .in("location_id", locationIds)
    .gte("created_at", since);

  if (orderError || !orders?.length) {
    return [];
  }

  const orderIds = orders.map((row) => (row as { id: string }).id);

  const { data: events, error: eventError } = await admin
    .from("outbox_events")
    .select("event_type, status, created_at, processed_at")
    .in("aggregate_id", orderIds)
    .gte("created_at", since);

  if (eventError || !events?.length) {
    return [];
  }

  const snapshot: OutboxHandlerMetricsSnapshot = {};

  for (const row of events) {
    const event = row as {
      event_type: string;
      status: string;
      created_at: string;
      processed_at: string | null;
    };

    if (event.status === "done") {
      const latencyMs = event.processed_at
        ? Math.max(
            0,
            new Date(event.processed_at).getTime() -
              new Date(event.created_at).getTime()
          )
        : 0;
      recordHandlerMetric(snapshot, event.event_type, "processed", latencyMs);
    } else if (event.status === "failed") {
      recordHandlerMetric(snapshot, event.event_type, "deadLetter", 0);
    }
  }

  return snapshotToHandlerMetrics(snapshot);
}

export async function processOutboxBatch(
  batchSize = OUTBOX_BATCH_SIZE
): Promise<ProcessOutboxResult> {
  const admin = createAdminClient();
  const handlerMetrics = emptyHandlerMetrics();
  const result: ProcessOutboxResult = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    deadLetter: 0,
    recoveredStale: 0,
    handlerMetrics,
  };

  result.recoveredStale = await recoverStaleProcessing(admin);

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_outbox_events",
    { p_limit: batchSize }
  );

  if (claimError) {
    if (
      claimError.code === "42883" ||
      claimError.message.includes("does not exist")
    ) {
      logger.warn("claim_outbox_events missing — run migration 00064", {
        error: claimError.message,
      });
      return result;
    }
    throw new Error(claimError.message);
  }

  const events: OutboxEventRow[] = claimed ?? [];
  result.claimed = events.length;

  for (const event of events) {
    const outcome = await processClaimedOutboxEvent(admin, event, handlerMetrics);

    if (outcome === "succeeded") {
      result.succeeded += 1;
    } else if (outcome === "failed") {
      result.failed += 1;
    } else {
      result.deadLetter += 1;
    }
  }

  if (result.claimed > 0) {
    logger.info("Outbox batch processed", {
      ...result,
      handlerMetrics: snapshotToHandlerMetrics(handlerMetrics),
    });
  }

  return result;
}
