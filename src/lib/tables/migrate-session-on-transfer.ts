import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { logger } from "@/lib/logger";
import { scheduleTableTransferGuestNotification } from "@/lib/scene/schedule-table-transfer-scene-refresh";
import type { SupabaseClient } from "@supabase/supabase-js";

type MigrateSessionOnTransferInput = {
  admin: SupabaseClient;
  locationId: string;
  fromTableId: string;
  toTableId: string;
  fromSessionId: string | null;
  toSessionId: string;
  toTableName: string;
  transferType: "full" | "partial";
  orderIds: string[];
  notifyGuests?: boolean;
  guestNotifyKind?: "transfer" | "split";
};

/** Move party devices, ai_sessions, timeline markers, and guest scene on transfer. */
export async function migrateSessionOnTransfer(
  input: MigrateSessionOnTransferInput
): Promise<void> {
  const {
    admin,
    fromTableId,
    toTableId,
    fromSessionId,
    toSessionId,
    toTableName,
    transferType,
    orderIds,
  } = input;

  if (!fromSessionId || transferType !== "full") {
    if (input.notifyGuests !== false) {
      await scheduleTableTransferGuestNotification(admin, {
        tableSessionId: input.toSessionId,
        toTableName,
        kind: input.guestNotifyKind ?? "transfer",
      });
    }
    return;
  }

  const { data: partyDevices } = await admin
    .from("denis_party_devices")
    .select("ai_session_id, device_fingerprint")
    .eq("table_session_id", fromSessionId);

  const aiSessionIds = new Set<string>();
  for (const row of (partyDevices ?? []) as Array<{
    ai_session_id: string | null;
  }>) {
    if (row.ai_session_id) aiSessionIds.add(row.ai_session_id);
  }

  const { data: fromSessionRow } = await admin
    .from("table_sessions")
    .select("denis_shared_ai_session_id")
    .eq("id", fromSessionId)
    .maybeSingle();

  const sharedAiSessionId = (
    fromSessionRow as { denis_shared_ai_session_id: string | null } | null
  )?.denis_shared_ai_session_id;
  if (sharedAiSessionId) aiSessionIds.add(sharedAiSessionId);

  if (aiSessionIds.size > 0) {
    const { error: aiUpdateError } = await admin
      .from("ai_sessions")
      .update({ table_id: toTableId })
      .in("id", [...aiSessionIds]);

    if (aiUpdateError) {
      logger.warn("migrateSessionOnTransfer: ai_sessions update failed", {
        fromSessionId,
        toTableId,
        error: aiUpdateError.message,
      });
    }
  }

  const { error: partyMoveError } = await admin
    .from("denis_party_devices" as never)
    .update({ table_session_id: toSessionId, table_id: toTableId } as never)
    .eq("table_session_id", fromSessionId);

  if (partyMoveError) {
    logger.warn("migrateSessionOnTransfer: party devices move failed", {
      fromSessionId,
      toSessionId,
      error: partyMoveError.message,
    });
  }

  if (sharedAiSessionId) {
    await admin
      .from("table_sessions")
      .update({ denis_shared_ai_session_id: sharedAiSessionId })
      .eq("id", toSessionId);
  }

  for (const aiSessionId of aiSessionIds) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId,
      eventType: "table.transferred",
      payload: {
        type: "table.transferred",
        fromTableId,
        toTableId,
        fromSessionId,
        toSessionId,
        orderIds,
        transferType,
      },
    });
  }

  if (input.notifyGuests !== false) {
    await scheduleTableTransferGuestNotification(admin, {
      tableSessionId: toSessionId,
      toTableName,
      kind: input.guestNotifyKind ?? "transfer",
    });
  }
}
