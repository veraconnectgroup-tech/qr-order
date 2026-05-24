import {
  buildOutboxEvents,
  orderEventIdempotencyKey,
  orderEventTypeForPhase,
} from "@/lib/outbox/build-outbox-events";
import { loadOrderOutboxContext } from "@/lib/outbox/load-outbox-context";
import { scheduleOutboxProcess } from "@/lib/outbox/schedule-process";
import type { OrderSideEffectPhase } from "@/lib/outbox/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type PersistOrderSideEffectsInput = {
  orderId: string;
  locationId: string;
  orgId: string;
  orderNumber: number;
  tableName: string;
  total: number;
  paymentStatus: string;
  guestEmail?: string | null;
  orderSource?: string;
  phase: OrderSideEffectPhase;
  actorType?: string | null;
  actorId?: string | null;
};

export type PersistOrderSideEffectsResult = {
  orderEventInserted: boolean;
  outboxCount: number;
};

export async function persistOrderSideEffects(
  admin: ReturnType<typeof createAdminClient>,
  input: PersistOrderSideEffectsInput
): Promise<PersistOrderSideEffectsResult> {
  const idempotencyKey = orderEventIdempotencyKey(input.phase);
  const eventType = orderEventTypeForPhase(input.phase);

  const { data: orderEvent, error: orderEventError } = await admin
    .from("order_events" as never)
    .insert({
      order_id: input.orderId,
      event_type: eventType,
      payload: {
        orderNumber: input.orderNumber,
        locationId: input.locationId,
        total: input.total,
        phase: input.phase,
      },
      idempotency_key: idempotencyKey,
      actor_type: input.actorType ?? null,
      actor_id: input.actorId ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  if (orderEventError) {
    if (
      orderEventError.code === "42P01" ||
      orderEventError.message.includes("does not exist")
    ) {
      logger.warn("order_events table missing — run migrations 00061+", {
        orderId: input.orderId,
      });
      return { orderEventInserted: false, outboxCount: 0 };
    }

    if (orderEventError.code === "23505") {
      return { orderEventInserted: false, outboxCount: 0 };
    }

    logger.error("order_events insert failed", {
      orderId: input.orderId,
      error: orderEventError.message,
    });
    return { orderEventInserted: false, outboxCount: 0 };
  }

  if (!orderEvent) {
    return { orderEventInserted: false, outboxCount: 0 };
  }

  const ctx = await loadOrderOutboxContext(admin, input);
  const outboxRows = buildOutboxEvents(ctx, input.phase);

  if (!outboxRows.length) {
    return { orderEventInserted: true, outboxCount: 0 };
  }

  const { error: outboxError } = await admin.from("outbox_events" as never).insert(
    outboxRows.map((row) => ({
      aggregate_type: row.aggregate_type ?? "order",
      aggregate_id: row.aggregate_id,
      domain: row.domain,
      event_type: row.event_type,
      payload: row.payload,
    })) as never
  );

  if (outboxError) {
    if (
      outboxError.code === "42P01" ||
      outboxError.message.includes("does not exist")
    ) {
      logger.warn("outbox_events table missing — run migrations 00061+", {
        orderId: input.orderId,
      });
      return { orderEventInserted: true, outboxCount: 0 };
    }

    logger.error("outbox_events insert failed", {
      orderId: input.orderId,
      error: outboxError.message,
    });
    return { orderEventInserted: true, outboxCount: 0 };
  }

  logger.info("Order side effects enqueued", {
    orderId: input.orderId,
    phase: input.phase,
    outboxCount: outboxRows.length,
  });

  scheduleOutboxProcess();

  return { orderEventInserted: true, outboxCount: outboxRows.length };
}
