import type { StaffProactiveAlert } from "@/lib/denis/cognition/proactive/proactive-types";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function emitStaffProactiveAlert(
  admin: SupabaseClient,
  input: {
    locationId: string;
    aiSessionId: string;
    tableId: string;
    alert: StaffProactiveAlert;
    orderId?: string | null;
    traceId?: string;
  }
): Promise<void> {
  const traceId = input.traceId ?? createTurnTraceId();

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "proactive.emitted",
    traceId,
    payload: {
      type: "proactive.emitted",
      audience: "staff",
      kind: input.alert.kind,
      message: input.alert.message,
      tableName: input.alert.tableName,
      detail: input.alert.detail ?? null,
      orderId: input.orderId ?? null,
      dedupeKey: input.alert.kind,
      source: "session.watcher",
    },
  });

  const result = await notifyLocationPush(input.locationId, {
    title: "Denis — sto zahteva pažnju",
    body: input.alert.message,
    url: "/dashboard/denis",
  });

  logger.info("Staff proactive alert delivered", {
    locationId: input.locationId,
    tableId: input.tableId,
    kind: input.alert.kind,
    ...result,
  });
}
