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
    .select("table_id")
    .eq("location_id", input.locationId)
    .in("id", sessionIds);

  if (sessionError) {
    logger.warn("forgetGuest table_sessions lookup failed", {
      locationId: input.locationId,
      error: sessionError.message,
    });
    return [];
  }

  const tableIds = [
    ...new Set(
      ((tableSessions ?? []) as Array<{ table_id: string }>).map((row) => row.table_id)
    ),
  ];
  if (tableIds.length === 0) return [];

  const { data: aiRows, error: aiError } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", input.locationId)
    .in("table_id", tableIds);

  if (aiError) {
    logger.warn("forgetGuest ai_sessions lookup failed", {
      locationId: input.locationId,
      error: aiError.message,
    });
    return [];
  }

  return ((aiRows ?? []) as Array<{ id: string }>).map((row) => row.id);
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
