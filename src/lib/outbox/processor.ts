import { getOutboxHandler } from "@/lib/outbox/handlers/registry";
import { computeOutboxNextRetryAt } from "@/lib/outbox/retry-delay";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const OUTBOX_BATCH_SIZE = 50;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

export type OutboxEventRow = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  domain: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string;
  last_error: string | null;
};

export type ProcessOutboxResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  deadLetter: number;
  recoveredStale: number;
};

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

export async function processOutboxBatch(
  batchSize = OUTBOX_BATCH_SIZE
): Promise<ProcessOutboxResult> {
  const admin = createAdminClient();
  const result: ProcessOutboxResult = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    deadLetter: 0,
    recoveredStale: 0,
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

  const events = (claimed ?? []) as unknown as OutboxEventRow[];
  result.claimed = events.length;

  for (const event of events) {
    const handler = getOutboxHandler(event.event_type);
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : {};

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
      result.succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await completeOutboxEvent(admin, {
        id: event.id,
        success: false,
        error: message,
        attempts: event.attempts,
      });

      if (event.attempts >= event.max_attempts) {
        result.deadLetter += 1;
        logger.error("Outbox event dead-lettered", {
          outboxId: event.id,
          eventType: event.event_type,
          aggregateId: event.aggregate_id,
          error: message,
        });
      } else {
        result.failed += 1;
        logger.warn("Outbox event scheduled for retry", {
          outboxId: event.id,
          eventType: event.event_type,
          attempts: event.attempts,
          error: message,
        });
      }
    }
  }

  if (result.claimed > 0) {
    logger.info("Outbox batch processed", result);
  }

  return result;
}
