import type { CommerceWorldSignalKind } from "@/lib/denis/loop/tell-world-order";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDenisWorldSignalOrderRow } from "@/lib/supabase/parse-order-rows";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function enqueueDenisWorldSignal(
  admin: SupabaseClient,
  input: {
    signal: CommerceWorldSignalKind;
    orderId: string;
    sessionId: string;
    locationId: string;
    tableId: string;
    tableToken: string;
    orderNumber: number;
    status: string;
    previousStatus?: string;
  }
): Promise<void> {
  try {
    await enqueueOutboxEvents(admin, [
      {
        aggregate_type: "session",
        aggregate_id: input.sessionId,
        domain: "commerce",
        event_type: "commerce.denis.world",
        payload: {
          signal: input.signal,
          orderId: input.orderId,
          sessionId: input.sessionId,
          locationId: input.locationId,
          tableId: input.tableId,
          tableToken: input.tableToken,
          orderNumber: input.orderNumber,
          status: input.status,
          previousStatus: input.previousStatus,
        },
      },
    ]);
  } catch (error) {
    logger.warn("enqueueDenisWorldSignal failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function enqueueDenisWorldSignalForOrder(
  admin: SupabaseClient,
  input: {
    signal: CommerceWorldSignalKind;
    orderId: string;
    sessionId: string;
    status: string;
    previousStatus?: string;
  }
): Promise<void> {
  const { data: orderRow, error: orderError } = await admin
    .from("orders")
    .select(
      "id, order_number, status, location_id, session_id, tables!inner(id, qr_token)"
    )
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !orderRow) {
    logger.warn("enqueueDenisWorldSignalForOrder: order not found", {
      orderId: input.orderId,
    });
    return;
  }

  const order = parseDenisWorldSignalOrderRow(orderRow);

  if (!order.session_id || order.session_id !== input.sessionId) return;

  await enqueueDenisWorldSignal(admin, {
    signal: input.signal,
    orderId: input.orderId,
    sessionId: input.sessionId,
    locationId: order.location_id,
    tableId: order.tables.id,
    tableToken: order.tables.qr_token,
    orderNumber: order.order_number,
    status: input.status,
    previousStatus: input.previousStatus,
  });
}

/** Fire-and-forget from order lifecycle paths. */
export function scheduleDenisWorldSignal(
  input: Parameters<typeof enqueueDenisWorldSignalForOrder>[1]
): void {
  const admin = createAdminClient();
  void enqueueDenisWorldSignalForOrder(admin, input).catch((error) => {
    logger.warn("scheduleDenisWorldSignal failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
