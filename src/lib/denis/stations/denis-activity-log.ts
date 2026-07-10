import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { logger } from "@/lib/logger";

export type DenisActivityLogRow =
  Database["public"]["Tables"]["denis_activity_log"]["Row"];

/**
 * One row per real action Denis takes during a staff voice call — not a
 * transcript, just the actions (checked status, relayed a message,
 * remembered/finished a commitment). Cheap to write since it hooks into
 * the same place every tool call already passes through
 * (executeStationGeneralVoiceTool). Read back both by staff (visibility)
 * and by Denis himself (see listRecentActivity, fed into his own
 * instructions) — per the founder's framing, he's only as sharp as how
 * well he tracks what's actually been happening.
 */
export async function logActivity(
  admin: SupabaseClient,
  input: {
    locationId: string;
    station: "kitchen" | "bar" | null;
    staffId: string | null;
    action: string;
    summary: string;
  }
): Promise<void> {
  const { error } = await admin.from("denis_activity_log").insert({
    location_id: input.locationId,
    station: input.station,
    staff_id: input.staffId,
    action: input.action,
    summary: input.summary,
  });

  if (error) {
    logger.warn("logActivity insert failed", {
      locationId: input.locationId,
      action: input.action,
      error: error.message,
    });
  }
}

const RECENT_ACTIVITY_WINDOW_MS = 4 * 60 * 60_000;

/** Last few real actions at this location, recent enough to still be relevant — not a full day's history dumped into every call. */
export async function listRecentActivity(
  admin: SupabaseClient,
  input: { locationId: string; limit?: number }
): Promise<DenisActivityLogRow[]> {
  const since = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS).toISOString();

  const { data, error } = await admin
    .from("denis_activity_log")
    .select("*")
    .eq("location_id", input.locationId)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 6);

  if (error) return [];
  return (data ?? []) as DenisActivityLogRow[];
}
