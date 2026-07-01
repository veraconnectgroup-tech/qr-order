import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadRhythmPrepTopProducts } from "@/lib/denis/config/load-rhythm-prep-products";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type LocationRow = {
  id: string;
  name: string;
  timezone: string | null;
};

function localHourMinute(timezone: string | null, now = new Date()): string {
  const tz = timezone?.trim() || "Europe/Berlin";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function weekdayInTimezone(timezone: string | null, now = new Date()): number {
  const tz = timezone?.trim() || "Europe/Berlin";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? now.getUTCDay();
}

async function loadTopItemsForWeekday(
  admin: SupabaseClient,
  locationId: string,
  weekday: number,
  timezone: string | null,
  config: Awaited<ReturnType<typeof loadConciergeConfigForLocation>>
): Promise<Array<{ name: string; count: number }>> {
  return loadRhythmPrepTopProducts(admin, {
    locationId,
    config,
    timezone,
    weekday,
  });
}

const DAY_NAMES = [
  "nedelja",
  "ponedeljak",
  "utorak",
  "sreda",
  "četvrtak",
  "petak",
  "subota",
];

export type ProactiveDailyJobsResult = {
  prepAlerts: number;
  reportAlerts: number;
};

/** Daily prep + manager report hooks (hour-gated per location config). */
export async function runProactiveDailyJobs(
  admin: SupabaseClient
): Promise<ProactiveDailyJobsResult> {
  const { data: locations, error } = await admin
    .from("locations")
    .select("id, name, timezone")
    .eq("is_active", true);

  if (error || !locations?.length) {
    return { prepAlerts: 0, reportAlerts: 0 };
  }

  let prepAlerts = 0;
  let reportAlerts = 0;

  for (const location of locations as LocationRow[]) {
    try {
      const config = await loadConciergeConfigForLocation(location.id);
      if (!config.proactive.enabled) continue;

      const now = new Date();
      const localTime = localHourMinute(location.timezone, now);

      if (config.proactive.dailyPrep && localTime === config.proactive.dailyPrepHour) {
        const weekday = weekdayInTimezone(location.timezone, now);
        const topItems = await loadTopItemsForWeekday(
          admin,
          location.id,
          weekday,
          location.timezone,
          config
        );

        if (topItems.length) {
          const summary = topItems
            .map((item) => `${item.count}x ${item.name}`)
            .join(", ");
          const dayName = DAY_NAMES[weekday] ?? "danas";

          await notifyLocationPush(location.id, {
            title: "Denis — dnevna priprema",
            body: `Danas je ${dayName}. Prošlog ${dayName}a: ${summary}. Pripremi zalihe.`,
            url: "/dashboard/denis",
          });
          prepAlerts += 1;
        }
      }

      if (
        config.proactive.dailyReport &&
        localTime === config.proactive.dailyReportHour
      ) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const [{ count: orderCount }, { count: sessionCount }] =
          await Promise.all([
            admin
              .from("orders")
              .select("id", { count: "exact", head: true })
              .eq("location_id", location.id)
              .gte("created_at", start.toISOString()),
            admin
              .from("table_sessions")
              .select("id", { count: "exact", head: true })
              .eq("location_id", location.id)
              .gte("opened_at", start.toISOString()),
          ]);

        await notifyLocationPush(location.id, {
          title: "Denis — dnevni izveštaj",
          body: `Danas: ${orderCount ?? 0} narudžbina, ${sessionCount ?? 0} sesija. Detalji u admin panelu.`,
          url: "/admin/denis-insights",
        });
        reportAlerts += 1;
      }
    } catch (jobError) {
      logger.warn("runProactiveDailyJobs location failed", {
        locationId: location.id,
        error:
          jobError instanceof Error ? jobError.message : String(jobError),
      });
    }
  }

  return { prepAlerts, reportAlerts };
}
