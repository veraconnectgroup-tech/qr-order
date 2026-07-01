import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import type { createAdminClient } from "@/lib/supabase/admin";

export async function enqueueSessionEval(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    tableSessionId: string;
    locationId: string;
    aiSessionId?: string | null;
    ordersCount?: number;
    upsellOffered?: boolean;
    upsellAccepted?: boolean;
  }
): Promise<void> {
  await enqueueOutboxEvents(admin, [
    {
      aggregate_type: "session",
      aggregate_id: input.tableSessionId,
      domain: "session",
      event_type: "session.eval",
      payload: {
        tableSessionId: input.tableSessionId,
        locationId: input.locationId,
        aiSessionId: input.aiSessionId ?? null,
        ordersCount: input.ordersCount ?? 0,
      },
    },
  ]);
}
