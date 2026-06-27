import type { SupabaseClient } from "@supabase/supabase-js";

export const RHYTHM_SHADOW_MIN_COMPLETED_SESSIONS = 20;

/** ADR-042 C1 — completed sessions from experience analytics rollup. */
export async function countLocationCompletedSessions(
  admin: SupabaseClient,
  locationId: string
): Promise<number> {
  const { data, error } = await admin
    .from("experience_analytics_daily" as never)
    .select("sessions_closed")
    .eq("location_id", locationId);

  if (error || !data?.length) return 0;

  return (data as Array<{ sessions_closed?: number | null }>).reduce(
    (sum, row) => sum + Number(row.sessions_closed ?? 0),
    0
  );
}
