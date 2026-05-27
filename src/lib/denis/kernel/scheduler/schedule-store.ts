import type {
  DenisScheduleRow,
  ScheduledIntentDraft,
  ScheduledIntentPayload,
  ScheduledIntentType,
} from "@/lib/denis/kernel/scheduler/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type ScheduleUpsertRow = {
  ai_session_id: string;
  location_id: string;
  intent_type: ScheduledIntentType;
  run_at: string;
  payload: ScheduledIntentPayload;
  dedupe_key: string;
  status: "pending";
};

export async function upsertDenisSchedules(
  admin: SupabaseClient,
  aiSessionId: string,
  locationId: string,
  drafts: ScheduledIntentDraft[]
): Promise<number> {
  if (drafts.length === 0) return 0;

  const rows: ScheduleUpsertRow[] = drafts.map((draft) => ({
    ai_session_id: aiSessionId,
    location_id: locationId,
    intent_type: draft.intentType,
    run_at: draft.runAt,
    payload: draft.payload,
    dedupe_key: draft.dedupeKey,
    status: "pending",
  }));

  const { error } = await admin.from("denis_schedules").upsert(rows, {
    onConflict: "ai_session_id,dedupe_key",
    ignoreDuplicates: false,
  });

  if (error) {
    logger.warn("upsertDenisSchedules failed", {
      aiSessionId,
      error: error.message,
    });
    return 0;
  }

  return rows.length;
}

export async function claimDueDenisSchedules(
  admin: SupabaseClient,
  limit = 50
): Promise<DenisScheduleRow[]> {
  const { data, error } = await admin.rpc("claim_due_denis_schedules", {
    p_limit: limit,
  });

  if (error) {
    logger.warn("claim_due_denis_schedules failed", { error: error.message });
    return [];
  }

  return (data as DenisScheduleRow[]) ?? [];
}

export async function completeDenisSchedule(
  admin: SupabaseClient,
  scheduleId: string,
  status: "completed" | "cancelled" = "completed"
): Promise<void> {
  const { error } = await admin
    .from("denis_schedules")
    .update({
      status,
      processed_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (error) {
    logger.warn("completeDenisSchedule failed", {
      scheduleId,
      error: error.message,
    });
  }
}

export async function loadShownProactiveKeys(
  admin: SupabaseClient,
  aiSessionId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("denis_timeline")
    .select("payload")
    .eq("ai_session_id", aiSessionId)
    .eq("event_type", "proactive.emitted")
    .order("seq", { ascending: false })
    .limit(50);

  if (error) {
    logger.warn("loadShownProactiveKeys failed", {
      aiSessionId,
      error: error.message,
    });
    return [];
  }

  const keys: string[] = [];
  for (const row of (data as Array<{ payload: Record<string, unknown> }>) ?? []) {
    const dedupeKey = row.payload?.dedupeKey;
    if (typeof dedupeKey === "string") keys.push(dedupeKey);
  }
  return keys;
}

export function createScheduleAdminClient() {
  return createAdminClient();
}
