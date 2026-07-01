import { subDays, format } from "date-fns";
import {
  parseLocationRhythmPriors,
  servicePeriodFromHour,
  slotConfidence,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type {
  LocationRhythmPriorsJson,
  RhythmSlotPrior,
} from "@/lib/denis/config/rhythm-prior-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VenueRhythmHeatmapCell = {
  slotKey: string;
  dayOfWeek: number;
  hour: number;
  sampleSessions: number;
  confidence: number;
  dessertDelayP50Min: number | null;
  revenueEma: number | null;
  revpash: number | null;
  topProductName: string | null;
  servicePeriod: string;
};

export type VenueRhythmComparative = {
  recentSessions: number;
  recentRevenue: number;
  baselineSessionsPerDay: number;
  vsBaselinePct: number | null;
  trend: "up" | "flat" | "down";
};

export type VenueRhythmAdminSnapshot = {
  locationId: string;
  locationName: string;
  totalSeats: number;
  priorsUpdatedAt: string | null;
  rhythmEnabled: boolean;
  slotCount: number;
  heatmap: VenueRhythmHeatmapCell[];
  topSlots: VenueRhythmHeatmapCell[];
  comparative: VenueRhythmComparative | null;
};

const DAY_LABELS = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"];

export function dayLabel(dow: number): string {
  return DAY_LABELS[dow] ?? String(dow);
}

export function computeRevpash(
  revenueEma: number | null,
  totalSeats: number
): number | null {
  if (revenueEma == null || !Number.isFinite(revenueEma) || totalSeats <= 0) {
    return null;
  }
  return Math.round((revenueEma / totalSeats) * 100) / 100;
}

export function buildHeatmapFromPriors(input: {
  priors: LocationRhythmPriorsJson;
  totalSeats: number;
  minSampleSessions: number;
}): VenueRhythmHeatmapCell[] {
  const cells: VenueRhythmHeatmapCell[] = [];

  for (const [slotKey, slot] of Object.entries(input.priors.slots)) {
    const parsed = parseSlotKey(slotKey);
    if (!parsed) continue;

    cells.push(buildHeatmapCell({
      slotKey,
      dayOfWeek: parsed.dow,
      hour: parsed.hour,
      slot,
      totalSeats: input.totalSeats,
      minSampleSessions: input.minSampleSessions,
    }));
  }

  return cells.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour
  );
}

function parseSlotKey(slotKey: string): { dow: number; hour: number } | null {
  const [dowRaw, hourRaw] = slotKey.split(":");
  const dow = Number(dowRaw);
  const hour = Number(hourRaw);
  if (!Number.isFinite(dow) || !Number.isFinite(hour)) return null;
  return { dow, hour };
}

function buildHeatmapCell(input: {
  slotKey: string;
  dayOfWeek: number;
  hour: number;
  slot: RhythmSlotPrior;
  totalSeats: number;
  minSampleSessions: number;
}): VenueRhythmHeatmapCell {
  const confidence = slotConfidence(
    input.slot.sampleSessions,
    input.minSampleSessions
  );

  return {
    slotKey: input.slotKey,
    dayOfWeek: input.dayOfWeek,
    hour: input.hour,
    sampleSessions: input.slot.sampleSessions,
    confidence,
    dessertDelayP50Min: input.slot.dessertDelayP50Min,
    revenueEma: input.slot.revenueEma,
    revpash: computeRevpash(input.slot.revenueEma, input.totalSeats),
    topProductName: input.slot.topProducts[0]?.name ?? null,
    servicePeriod:
      input.slot.servicePeriod ?? servicePeriodFromHour(input.hour),
  };
}

export function computeComparativeTrend(input: {
  recentSessions: number;
  recentDays: number;
  baselineSessionsPerDay: number;
}): VenueRhythmComparative["trend"] {
  if (input.recentDays <= 0 || input.baselineSessionsPerDay <= 0) {
    return "flat";
  }

  const recentAvg = input.recentSessions / input.recentDays;
  const ratio = recentAvg / input.baselineSessionsPerDay;

  if (ratio >= 1.15) return "up";
  if (ratio <= 0.85) return "down";
  return "flat";
}

export async function loadVenueRhythmAdminSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    periodDays?: number;
  }
): Promise<VenueRhythmAdminSnapshot | null> {
  const periodDays = input.periodDays ?? 7;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");
  const baselineFrom = format(subDays(new Date(), 56), "yyyy-MM-dd");

  const { data: locationRow } = await admin
    .from("locations")
    .select("id, name, ai_concierge_config")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  const location = locationRow as {
    id: string;
    name: string;
    ai_concierge_config: unknown;
  };

  const rhythmConfig =
    location.ai_concierge_config &&
    typeof location.ai_concierge_config === "object" &&
    "rhythm" in (location.ai_concierge_config as object)
      ? (location.ai_concierge_config as { rhythm?: { enabled?: boolean } })
          .rhythm
      : null;

  const [{ data: priorsRow }, { data: seatRows }, { data: recentDaily }] =
    await Promise.all([
      admin
        .from("location_rhythm_priors" as never)
        .select("priors, updated_at")
        .eq("location_id", input.locationId)
        .maybeSingle(),
      admin.from("tables").select("seats").eq("location_id", input.locationId),
      admin
        .from("experience_analytics_daily" as never)
        .select("metric_date, sessions_closed, session_revenue_total")
        .eq("location_id", input.locationId)
        .gte("metric_date", fromDate)
        .lte("metric_date", toDate),
    ]);

  const totalSeats = ((seatRows ?? []) as Array<{ seats: number | null }>).reduce(
    (sum, row) => sum + Math.max(0, Number(row.seats ?? 0)),
    0
  );

  const priors =
    parseLocationRhythmPriors(
      (priorsRow as { priors?: unknown } | null)?.priors
    ) ?? { version: 1 as const, slots: {} };

  const minSampleSessions = 8;
  const heatmap = buildHeatmapFromPriors({
    priors,
    totalSeats: Math.max(totalSeats, 1),
    minSampleSessions,
  });

  const topSlots = [...heatmap]
    .filter((cell) => cell.sampleSessions >= 3)
    .sort((a, b) => (b.revpash ?? 0) - (a.revpash ?? 0))
    .slice(0, 5);

  let comparative: VenueRhythmComparative | null = null;

  try {
    const { data: baselineRows } = await admin
      .from("experience_analytics_daily" as never)
      .select("metric_date, sessions_closed, session_revenue_total")
      .eq("location_id", input.locationId)
      .gte("metric_date", baselineFrom)
      .lt("metric_date", fromDate);

    const recent = (recentDaily ?? []) as Array<{
      sessions_closed: number;
      session_revenue_total: number;
    }>;
    const baseline = (baselineRows ?? []) as Array<{
      sessions_closed: number;
    }>;

    const recentSessions = recent.reduce(
      (sum, row) => sum + Number(row.sessions_closed ?? 0),
      0
    );
    const recentRevenue = recent.reduce(
      (sum, row) => sum + Number(row.session_revenue_total ?? 0),
      0
    );
    const baselineSessions = baseline.reduce(
      (sum, row) => sum + Number(row.sessions_closed ?? 0),
      0
    );
    const baselineDays = Math.max(1, baseline.length);
    const baselineSessionsPerDay = baselineSessions / baselineDays;
    const recentAvg = recentSessions / Math.max(1, recent.length || periodDays);
    const vsBaselinePct =
      baselineSessionsPerDay > 0
        ? Math.round(
            ((recentAvg - baselineSessionsPerDay) / baselineSessionsPerDay) *
              100
          )
        : null;

    comparative = {
      recentSessions,
      recentRevenue: Math.round(recentRevenue * 100) / 100,
      baselineSessionsPerDay: Math.round(baselineSessionsPerDay * 10) / 10,
      vsBaselinePct,
      trend: computeComparativeTrend({
        recentSessions,
        recentDays: Math.max(1, recent.length || periodDays),
        baselineSessionsPerDay,
      }),
    };
  } catch (error) {
    logger.warn("loadVenueRhythmAdminSnapshot comparative failed", {
      locationId: input.locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    locationId: location.id,
    locationName: location.name,
    totalSeats,
    priorsUpdatedAt:
      (priorsRow as { updated_at?: string } | null)?.updated_at ?? null,
    rhythmEnabled: rhythmConfig?.enabled === true,
    slotCount: heatmap.length,
    heatmap,
    topSlots,
    comparative,
  };
}
