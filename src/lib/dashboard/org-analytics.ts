import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateDenisRoiRows,
  type ExperienceAnalyticsDailyRow,
} from "@/lib/dashboard/denis-roi";

export type OrgAnalyticsLocationRow = {
  locationId: string;
  locationName: string;
  sessions: number;
  conversionRate: number;
  revenue: number;
  aiCost: number;
  personaTone: string | null;
};

export type OrgAnalyticsInsight = {
  message: string;
  suggestion?: string;
};

export type OrgAnalyticsData = {
  period: { start: string; end: string };
  locations: OrgAnalyticsLocationRow[];
  totals: {
    sessions: number;
    conversionRate: number;
    revenue: number;
    aiCost: number;
  };
  insights: OrgAnalyticsInsight[];
};

type LocationMeta = {
  id: string;
  name: string;
  ai_concierge_config: { persona?: { tone?: string } } | null;
};

function extractTone(config: LocationMeta["ai_concierge_config"]): string | null {
  const tone = config?.persona?.tone;
  return typeof tone === "string" ? tone : null;
}

function buildOrgInsights(rows: OrgAnalyticsLocationRow[]): OrgAnalyticsInsight[] {
  if (rows.length < 2) return [];

  const sorted = [...rows].sort((a, b) => b.conversionRate - a.conversionRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (!best || !worst || best.locationId === worst.locationId) return [];

  const insights: OrgAnalyticsInsight[] = [
    {
      message: `${best.locationName} leads at ${(best.conversionRate * 100).toFixed(0)}% conversion`,
      suggestion:
        best.personaTone && worst.personaTone && best.personaTone !== worst.personaTone
          ? `${worst.locationName} uses "${worst.personaTone}" — try "${best.personaTone}" like ${best.locationName}?`
          : undefined,
    },
  ];

  return insights;
}

export async function fetchOrgAnalytics(
  admin: SupabaseClient,
  input: {
    orgId: string;
    fromDate: string;
    toDate: string;
  }
): Promise<OrgAnalyticsData> {
  const { data: locationRows } = await admin
    .from("locations")
    .select("id, name, ai_concierge_config")
    .eq("org_id", input.orgId)
    .eq("is_active", true);

  const locations = (locationRows ?? []) as LocationMeta[];
  const locationIds = locations.map((row) => row.id);

  if (locationIds.length === 0) {
    return {
      period: { start: input.fromDate, end: input.toDate },
      locations: [],
      totals: { sessions: 0, conversionRate: 0, revenue: 0, aiCost: 0 },
      insights: [],
    };
  }

  const { data: dailyRows, error } = await admin
    .from("experience_analytics_daily" as never)
    .select(
      "location_id, metric_date, sessions_closed, session_revenue_total, converted_sessions, ai_cost_cents"
    )
    .eq("org_id", input.orgId)
    .gte("metric_date", input.fromDate)
    .lte("metric_date", input.toDate);

  if (error) {
    throw new Error(error.message);
  }

  const byLocation = new Map<string, ExperienceAnalyticsDailyRow[]>();
  for (const row of dailyRows ?? []) {
    const typed = row as ExperienceAnalyticsDailyRow & { location_id: string };
    const list = byLocation.get(typed.location_id) ?? [];
    list.push(typed);
    byLocation.set(typed.location_id, list);
  }

  const locationAnalytics: OrgAnalyticsLocationRow[] = locations.map((location) => {
    const agg = aggregateDenisRoiRows(byLocation.get(location.id) ?? []);
    return {
      locationId: location.id,
      locationName: location.name,
      sessions: agg.sessionsTotal,
      conversionRate:
        agg.sessionsTotal > 0
          ? agg.sessionsConverted / agg.sessionsTotal
          : 0,
      revenue: agg.revenueTotal,
      aiCost: agg.aiCostCents / 100,
      personaTone: extractTone(location.ai_concierge_config),
    };
  });

  locationAnalytics.sort((a, b) => b.sessions - a.sessions);

  const totalsAgg = aggregateDenisRoiRows(
    [...byLocation.values()].flat()
  );

  return {
    period: { start: input.fromDate, end: input.toDate },
    locations: locationAnalytics,
    totals: {
      sessions: totalsAgg.sessionsTotal,
      conversionRate:
        totalsAgg.sessionsTotal > 0
          ? totalsAgg.sessionsConverted / totalsAgg.sessionsTotal
          : 0,
      revenue: totalsAgg.revenueTotal,
      aiCost: totalsAgg.aiCostCents / 100,
    },
    insights: buildOrgInsights(locationAnalytics),
  };
}

export function orgAnalyticsToCsv(data: OrgAnalyticsData): string {
  const header =
    "Location,Sessions,Conversion %,Revenue,AI Cost,Persona Tone";
  const lines = data.locations.map((row) =>
    [
      `"${row.locationName.replace(/"/g, '""')}"`,
      row.sessions,
      (row.conversionRate * 100).toFixed(1),
      row.revenue.toFixed(2),
      row.aiCost.toFixed(2),
      row.personaTone ?? "",
    ].join(",")
  );
  const totalLine = [
    "TOTAL",
    data.totals.sessions,
    (data.totals.conversionRate * 100).toFixed(1),
    data.totals.revenue.toFixed(2),
    data.totals.aiCost.toFixed(2),
    "",
  ].join(",");
  return [header, ...lines, totalLine].join("\n");
}
