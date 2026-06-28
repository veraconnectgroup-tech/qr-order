import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStaffTrainingSnapshot } from "@/lib/admin/load-staff-training-insight";
import { dispatchStaffTrainingAlerts } from "@/lib/denis/notifications/dispatch-staff-training-alerts";
import { logger } from "@/lib/logger";

/** Weekly tick — load training insights per location and push owner/manager alerts. */
export async function runStaffTrainingAlertsTick(
  admin: SupabaseClient,
  options?: { limit?: number; periodDays?: number }
): Promise<{
  locations: number;
  dispatched: number;
  skipped: number;
  noAction: number;
}> {
  const limit = options?.limit ?? 50;
  const periodDays = options?.periodDays ?? 7;

  const { data: locationRows } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  let dispatched = 0;
  let skipped = 0;
  let noAction = 0;

  for (const row of locationRows ?? []) {
    const locationId = (row as { id: string }).id;
    const orgId = (row as { org_id: string }).org_id;

    const snapshot = await loadStaffTrainingSnapshot(admin, {
      locationId,
      orgId,
      periodDays,
    });

    if (!snapshot || snapshot.insights.length === 0) {
      noAction += 1;
      continue;
    }

    const result = await dispatchStaffTrainingAlerts({
      orgId,
      locationId,
      insights: snapshot.insights,
    });

    dispatched += result.dispatched;
    skipped += result.skipped;

    if (result.dispatched === 0 && result.skipped === 0) {
      noAction += 1;
    }
  }

  logger.info("Staff training alerts tick completed", {
    locations: locationRows?.length ?? 0,
    dispatched,
    skipped,
    noAction,
  });

  return {
    locations: locationRows?.length ?? 0,
    dispatched,
    skipped,
    noAction,
  };
}
