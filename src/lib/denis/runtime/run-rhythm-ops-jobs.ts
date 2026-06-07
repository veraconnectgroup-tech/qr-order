import { getAiRedis } from "@/lib/ai/redis";
import { evaluateRhythmOpsAlerts } from "@/lib/denis/config/evaluate-rhythm-ops-alerts";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import { emptyLocationRhythmPriors } from "@/lib/denis/config/resolve-rhythm-priors";
import { isRhythmActive } from "@/lib/denis/config/resolve-rhythm-mode";
import {
  localHourAndMinute,
  weekdayInTimezone,
} from "@/lib/denis/config/venue-local-time";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type LocationRow = {
  id: string;
  name: string;
  timezone: string | null;
};

export type RhythmOpsJobsResult = {
  rushAlerts: number;
  staffingAlerts: number;
  skipped: number;
};

function opsAlertDedupeKey(
  locationId: string,
  kind: "rush" | "staffing",
  slotKey: string
): string {
  return `ai:rhythm-ops:${locationId}:${kind}:${slotKey}`;
}

async function shouldSendOpsAlert(
  locationId: string,
  kind: "rush" | "staffing",
  slotKey: string
): Promise<boolean> {
  const redis = getAiRedis();
  if (!redis) return true;

  const key = opsAlertDedupeKey(locationId, kind, slotKey);
  const existing = await redis.get<string>(key);
  if (existing) return false;

  await redis.set(key, "1", { ex: 7200 });
  return true;
}

/** Hourly ops alerts from rhythm priors + live floor (VRP-P4, staff only). */
export async function runRhythmOpsJobs(
  admin: SupabaseClient
): Promise<RhythmOpsJobsResult> {
  const { data: locations, error } = await admin
    .from("locations")
    .select("id, name, timezone")
    .eq("is_active", true);

  if (error || !locations?.length) {
    return { rushAlerts: 0, staffingAlerts: 0, skipped: 0 };
  }

  let rushAlerts = 0;
  let staffingAlerts = 0;
  let skipped = 0;

  for (const location of locations as LocationRow[]) {
    try {
      const config = await loadConciergeConfigForLocation(location.id);
      if (!isRhythmActive(config)) continue;
      if (!config.rhythm.ops.rushAlerts && !config.rhythm.ops.staffingHints) {
        continue;
      }

      const now = new Date();
      const { hour, minute } = localHourAndMinute(location.timezone, now);
      const dow = weekdayInTimezone(location.timezone, now);

      const priorsRow = await loadLocationRhythmPriors(admin, location.id);
      const priors = priorsRow?.priors ?? emptyLocationRhythmPriors();

      const [{ count: activeSessions }, { data: seatRows }] = await Promise.all([
        admin
          .from("table_sessions")
          .select("id", { count: "exact", head: true })
          .eq("location_id", location.id)
          .eq("status", "active"),
        admin.from("tables").select("seats").eq("location_id", location.id),
      ]);

      const totalSeats = ((seatRows ?? []) as Array<{ seats: number | null }>).reduce(
        (sum, row) => sum + Math.max(0, Number(row.seats ?? 0)),
        0
      );

      const evaluation = evaluateRhythmOpsAlerts({
        priors,
        localDow: dow,
        localHour: hour,
        localMinute: minute,
        minSampleSessions: config.rhythm.minSampleSessions,
        rushThreshold: config.rhythm.ops.rushThreshold,
        rushAlerts: config.rhythm.ops.rushAlerts,
        staffingHints: config.rhythm.ops.staffingHints,
        activeSessions: activeSessions ?? 0,
        totalSeats,
        targetSessionsPerWaiter: config.rhythm.ops.targetSessionsPerWaiter,
        staffingOccupancyThreshold: config.rhythm.ops.staffingOccupancyThreshold,
      });

      if (!evaluation) {
        skipped += 1;
        continue;
      }

      if (evaluation.rushAlert) {
        const send = await shouldSendOpsAlert(
          location.id,
          "rush",
          evaluation.nextSlotKey
        );
        if (send) {
          await notifyLocationPush(location.id, {
            title: "Denis — očekivana gužva",
            body: `Za sat ${evaluation.nextHour}:00 tipično ${evaluation.nextSlotSessions} sesija (${evaluation.rushIndex}× median). Pripremi floor.`,
            url: "/dashboard/denis",
          });
          rushAlerts += 1;
        }
      }

      if (evaluation.staffingAlert) {
        const send = await shouldSendOpsAlert(
          location.id,
          "staffing",
          evaluation.nextSlotKey
        );
        if (send) {
          await notifyLocationPush(location.id, {
            title: "Denis — staffing hint",
            body: `Popunjenost ${Math.round(evaluation.liveOccupancy * 100)}% · gužva u ${evaluation.nextHour}:00. Predlog: ~${evaluation.suggestedWaiters} konobara.`,
            url: "/dashboard/denis",
          });
          staffingAlerts += 1;
        }
      }
    } catch (jobError) {
      logger.warn("runRhythmOpsJobs location failed", {
        locationId: location.id,
        error:
          jobError instanceof Error ? jobError.message : String(jobError),
      });
    }
  }

  return { rushAlerts, staffingAlerts, skipped };
}
