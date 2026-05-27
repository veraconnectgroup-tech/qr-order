import {
  AI_LOW_BALANCE_THRESHOLD,
  BILLING_EVENT_TYPES,
} from "@/lib/denis/commercial/billing-events";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Enqueue staff-visible low-balance side effect (ADR-009 F4). */
export async function maybeEnqueueLowBalanceAlert(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    balanceAfter: number;
    traceId: string;
    threshold?: number;
  }
): Promise<void> {
  const threshold = input.threshold ?? AI_LOW_BALANCE_THRESHOLD;
  if (input.balanceAfter > threshold) return;

  try {
    await enqueueOutboxEvents(admin, [
      {
        aggregate_type: "session",
        aggregate_id: input.orgId,
        domain: "billing",
        event_type: "billing.low_balance",
        payload: {
          type: BILLING_EVENT_TYPES.lowBalance,
          orgId: input.orgId,
          locationId: input.locationId,
          balance: input.balanceAfter,
          threshold,
          traceId: input.traceId,
        },
      },
    ]);
  } catch (error) {
    logger.warn("billing.low_balance outbox enqueue failed", {
      orgId: input.orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
