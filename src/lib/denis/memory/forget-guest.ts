/**
 * ADR-045 S3 — guest "zaboravi me": erase device-bound memory and anonymize
 * shift-tier PII traces. Order/fiscal data stays intact (legal obligation).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteGuestMemory } from "@/lib/guest/denis-guest-memory-store";
import { logger } from "@/lib/logger";

export type ForgetGuestResult = {
  memoryDeleted: boolean;
  notificationPrefsDeleted: number;
  turnTracesDeleted: number;
  timelineEventsDeleted: number;
};

async function resolveAiSessionIdsForDevice(
  admin: SupabaseClient,
  input: { locationId: string; deviceFingerprint: string }
): Promise<string[]> {
  const { data: deviceRows, error: deviceError } = await admin
    .from("session_devices")
    .select("session_id")
    .eq("device_fingerprint", input.deviceFingerprint);

  if (deviceError) {
    logger.warn("forgetGuest session_devices lookup failed", {
      locationId: input.locationId,
      error: deviceError.message,
    });
    return [];
  }

  const sessionIds = [
    ...new Set(
      ((deviceRows ?? []) as Array<{ session_id: string }>).map((row) => row.session_id)
    ),
  ];
  if (sessionIds.length === 0) return [];

  const { data: tableSessions, error: sessionError } = await admin
    .from("table_sessions")
    .select("table_id, opened_at, closed_at")
    .eq("location_id", input.locationId)
    .in("id", sessionIds);

  if (sessionError) {
    logger.warn("forgetGuest table_sessions lookup failed", {
      locationId: input.locationId,
      error: sessionError.message,
    });
    return [];
  }

  const visits = (tableSessions ?? []) as Array<{
    table_id: string;
    opened_at: string;
    closed_at: string | null;
  }>;
  if (visits.length === 0) return [];

  // ai_sessions has no table_session_id — it only carries table_id, and a
  // table is reused by many unrelated guests over time. Scoping by table_id
  // alone would sweep in other guests' sessions at the same physical table.
  // Instead, scope each visit to its own opened_at..closed_at window.
  const idSets = await Promise.all(
    visits.map(async (visit) => {
      let query = admin
        .from("ai_sessions")
        .select("id")
        .eq("location_id", input.locationId)
        .eq("table_id", visit.table_id)
        .gte("created_at", visit.opened_at);
      if (visit.closed_at) {
        query = query.lte("created_at", visit.closed_at);
      }
      const { data, error } = await query;
      if (error) {
        logger.warn("forgetGuest ai_sessions lookup failed", {
          locationId: input.locationId,
          error: error.message,
        });
        return [];
      }
      return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
    })
  );

  return [...new Set(idSets.flat())];
}

export async function forgetGuestCompletely(
  admin: SupabaseClient,
  input: {
    locationId: string;
    deviceFingerprint: string;
  }
): Promise<ForgetGuestResult> {
  const result: ForgetGuestResult = {
    memoryDeleted: false,
    notificationPrefsDeleted: 0,
    turnTracesDeleted: 0,
    timelineEventsDeleted: 0,
  };

  result.memoryDeleted = await deleteGuestMemory(admin, input);

  const { data: prefs, error: prefsError } = await admin
    .from("guest_notification_preferences" as never)
    .delete()
    .eq("location_id", input.locationId)
    .eq("device_fingerprint", input.deviceFingerprint)
    .select("id");

  if (prefsError) {
    logger.warn("forgetGuest notification prefs delete failed", {
      locationId: input.locationId,
      error: prefsError.message,
    });
  } else {
    result.notificationPrefsDeleted = (prefs ?? []).length;
  }

  const aiSessionIds = await resolveAiSessionIdsForDevice(admin, input);
  if (aiSessionIds.length === 0) {
    logger.info("forgetGuest completed", {
      locationId: input.locationId,
      ...result,
    });
    return result;
  }

  const { data: traces, error: traceError } = await admin
    .from("denis_turn_traces")
    .delete()
    .eq("location_id", input.locationId)
    .in("ai_session_id", aiSessionIds)
    .select("id");

  if (traceError) {
    logger.warn("forgetGuest turn traces delete failed", {
      locationId: input.locationId,
      error: traceError.message,
    });
  } else {
    result.turnTracesDeleted = (traces ?? []).length;
  }

  const { data: timeline, error: timelineError } = await admin
    .from("denis_timeline")
    .delete()
    .in("ai_session_id", aiSessionIds)
    .select("id");

  if (timelineError) {
    logger.warn("forgetGuest timeline delete failed", {
      locationId: input.locationId,
      error: timelineError.message,
    });
  } else {
    result.timelineEventsDeleted = (timeline ?? []).length;
  }

  logger.info("forgetGuest completed", {
    locationId: input.locationId,
    aiSessionCount: aiSessionIds.length,
    ...result,
  });

  return result;
}
