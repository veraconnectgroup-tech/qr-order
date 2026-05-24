import { scheduleOutboxProcess } from "@/lib/outbox/schedule-process";
import type { OutboxInsert } from "@/lib/outbox/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function enqueueFiscalSendReceipt(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  guestEmail?: string | null
): Promise<number> {
  return enqueueOutboxEvents(admin, [
    {
      aggregate_id: orderId,
      domain: "fiscal",
      event_type: "fiscal.send_receipt",
      payload: { orderId, guestEmail: guestEmail ?? null },
    },
  ]);
}

export async function enqueueOutboxEvents(
  admin: ReturnType<typeof createAdminClient>,
  events: OutboxInsert[]
): Promise<number> {
  if (!events.length) return 0;

  const { error } = await admin.from("outbox_events" as never).insert(
    events.map((row) => ({
      aggregate_type: row.aggregate_type ?? "order",
      aggregate_id: row.aggregate_id,
      domain: row.domain,
      event_type: row.event_type,
      payload: row.payload,
    })) as never
  );

  if (error) {
    throw new Error(`outbox_events insert failed: ${error.message}`);
  }

  logger.info("Outbox follow-up events enqueued", {
    count: events.length,
    types: events.map((event) => event.event_type),
  });

  scheduleOutboxProcess();
  return events.length;
}
