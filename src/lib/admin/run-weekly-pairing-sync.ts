import type { SupabaseClient } from "@supabase/supabase-js";
import { weekdayInTimezone } from "@/lib/admin/load-daily-prep-briefing-context";
import { syncDiscoveredPairingsForLocation } from "@/lib/admin/sync-discovered-pairings";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { logger } from "@/lib/logger";

/** Run weekly (Monday 05:00 local) when learned edges enabled. */
export async function runWeeklyDiscoveredPairingsSync(
  admin: SupabaseClient,
  input?: { now?: Date }
): Promise<{ locations: number; discovered: number }> {
  const now = input?.now ?? new Date();
  let locations = 0;
  let discovered = 0;

  const { data: locationRows, error } = await admin
    .from("locations")
    .select("id, timezone")
    .eq("ai_concierge_enabled", true)
    .eq("is_active", true);

  if (error || !locationRows?.length) {
    return { locations: 0, discovered: 0 };
  }

  for (const row of locationRows as Array<{ id: string; timezone: string | null }>) {
    const tz = row.timezone ?? "Europe/Berlin";
    const weekday = weekdayInTimezone(tz, now);
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        hour12: false,
      }).format(now)
    );

    if (weekday !== 1 || hour !== 5) continue;

    const config = await loadConciergeConfigForLocation(row.id);
    if (!config.learning.learnedEdgesEnabled) continue;

    try {
      const result = await syncDiscoveredPairingsForLocation(admin, {
        locationId: row.id,
      });
      locations += 1;
      discovered += result.discovered;
    } catch (syncError) {
      logger.warn("Weekly discovered pairings sync failed", {
        locationId: row.id,
        error:
          syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  return { locations, discovered };
}
