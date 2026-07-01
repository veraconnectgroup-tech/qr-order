import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchActionableInsightsForLocation } from "@/lib/dashboard/dispatch-actionable-insights";
import { logger } from "@/lib/logger";

/** Morning owner briefing tick — daily digest + critical push (O1). */
export async function runActionableInsightsTick(
  admin: SupabaseClient,
  input?: { limit?: number; now?: Date }
): Promise<{
  processed: number;
  criticalSent: number;
  dailySent: number;
  pushSent: number;
  weeklySent: number;
}> {
  const limit = input?.limit ?? 50;
  const now = input?.now ?? new Date();
  const insightDate = now.toISOString().slice(0, 10);
  const isSunday = now.getUTCDay() === 0;

  const { data: locations } = await admin
    .from("locations")
    .select("id, org_id, name, ai_concierge_enabled")
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  let processed = 0;
  let criticalSent = 0;
  let dailySent = 0;
  let pushSent = 0;
  let weeklySent = 0;

  for (const row of locations ?? []) {
    const location = row as {
      id: string;
      org_id: string;
      name: string;
    };

    try {
      const result = await dispatchActionableInsightsForLocation(admin, {
        orgId: location.org_id,
        locationId: location.id,
        locationName: location.name,
        insightDate,
        range: isSunday ? "week" : "today",
      });

      processed += 1;
      criticalSent += result.criticalSent;
      dailySent += result.dailySent;
      pushSent += result.pushSent;
      weeklySent += result.weeklySent;
    } catch (error) {
      logger.warn("Actionable insights tick failed for location", {
        locationId: location.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, criticalSent, dailySent, pushSent, weeklySent };
}
