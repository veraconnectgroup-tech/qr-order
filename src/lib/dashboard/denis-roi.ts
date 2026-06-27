import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatAnalyticsIsoDate,
  getPreviousAnalyticsRange,
  resolveAnalyticsDateRange,
  type AnalyticsDateRange,
  type AnalyticsSearchParams,
} from "@/lib/analytics/date-range";
import type { ExperienceScoreSnapshot } from "@/lib/dashboard/load-experience-score";
import { loadExperienceScoreSnapshot } from "@/lib/dashboard/load-experience-score";

export type DenisRoiRange = "7d" | "30d" | "90d" | "custom";

export type DenisRoiData = {
  period: { start: string; end: string };
  revenue: {
    total: number;
    denisUpsell: number;
    upsellPercent: number;
    vsPrevious: number;
  };
  sessions: {
    total: number;
    converted: number;
    conversionRate: number;
    conversionVsPrevious: number;
    avgOrderTimeSeconds: number;
    vsPrevious: number;
  };
  cost: {
    totalAiCost: number;
    costPerSession: number;
    t0Percent: number;
    roi: number;
  };
  guests: {
    returning: number;
    returningPercent: number;
    avgVisitCount: number;
  };
  topPerformers: {
    category: string;
    accepted: number;
    revenue: number;
  }[];
  daily: {
    date: string;
    revenue: number;
    sessions: number;
    conversionRate: number;
  }[];
};

export type DenisRoiPayload = DenisRoiData & {
  experienceScore: ExperienceScoreSnapshot | null;
};

export type ExperienceAnalyticsDailyRow = {
  metric_date: string;
  sessions_closed: number;
  session_revenue_total: number;
  converted_sessions: number;
  upsell_revenue_total: number;
  ai_cost_cents: number;
  t0_turns: number;
  llm_turns: number;
  returning_guest_sessions: number;
  order_time_seconds_total: number;
  by_nudge_revenue: Record<string, { accepted?: number; revenue?: number }>;
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function pctPointChange(current: number, previous: number): number {
  return (current - previous) * 100;
}

function mergeNudgeRevenue(
  target: Map<string, { accepted: number; revenue: number }>,
  source: ExperienceAnalyticsDailyRow["by_nudge_revenue"]
): void {
  for (const [category, stats] of Object.entries(source ?? {})) {
    const existing = target.get(category) ?? { accepted: 0, revenue: 0 };
    existing.accepted += stats?.accepted ?? 0;
    existing.revenue += Number(stats?.revenue ?? 0);
    target.set(category, existing);
  }
}

export type DenisRoiAggregates = {
  sessionsTotal: number;
  sessionsConverted: number;
  revenueTotal: number;
  upsellRevenue: number;
  aiCostCents: number;
  t0Turns: number;
  llmTurns: number;
  returningGuestSessions: number;
  orderTimeSecondsTotal: number;
  nudgeRevenue: Map<string, { accepted: number; revenue: number }>;
  daily: Array<{
    date: string;
    revenue: number;
    sessions: number;
    converted: number;
  }>;
};

export function aggregateDenisRoiRows(
  rows: ExperienceAnalyticsDailyRow[]
): DenisRoiAggregates {
  const nudgeRevenue = new Map<string, { accepted: number; revenue: number }>();
  const daily: DenisRoiAggregates["daily"] = [];

  let sessionsTotal = 0;
  let sessionsConverted = 0;
  let revenueTotal = 0;
  let upsellRevenue = 0;
  let aiCostCents = 0;
  let t0Turns = 0;
  let llmTurns = 0;
  let returningGuestSessions = 0;
  let orderTimeSecondsTotal = 0;

  for (const row of rows) {
    const sessions = row.sessions_closed ?? 0;
    const converted = row.converted_sessions ?? 0;
    const revenue = Number(row.session_revenue_total ?? 0);
    const upsell = Number(row.upsell_revenue_total ?? 0);

    sessionsTotal += sessions;
    sessionsConverted += converted;
    revenueTotal += revenue;
    upsellRevenue += upsell;
    aiCostCents += row.ai_cost_cents ?? 0;
    t0Turns += row.t0_turns ?? 0;
    llmTurns += row.llm_turns ?? 0;
    returningGuestSessions += row.returning_guest_sessions ?? 0;
    orderTimeSecondsTotal += row.order_time_seconds_total ?? 0;
    mergeNudgeRevenue(nudgeRevenue, row.by_nudge_revenue);

    daily.push({
      date: row.metric_date,
      revenue,
      sessions,
      converted,
    });
  }

  daily.sort((a, b) => a.date.localeCompare(b.date));

  return {
    sessionsTotal,
    sessionsConverted,
    revenueTotal,
    upsellRevenue,
    aiCostCents,
    t0Turns,
    llmTurns,
    returningGuestSessions,
    orderTimeSecondsTotal,
    nudgeRevenue,
    daily,
  };
}

export function buildDenisRoiData(
  current: DenisRoiAggregates,
  previous: DenisRoiAggregates,
  period: { start: string; end: string }
): DenisRoiData {
  const conversionRate =
    current.sessionsTotal > 0
      ? current.sessionsConverted / current.sessionsTotal
      : 0;
  const prevConversionRate =
    previous.sessionsTotal > 0
      ? previous.sessionsConverted / previous.sessionsTotal
      : 0;

  const avgOrderTimeSeconds =
    current.sessionsConverted > 0
      ? Math.round(current.orderTimeSecondsTotal / current.sessionsConverted)
      : 0;

  const totalTurns = current.t0Turns + current.llmTurns;
  const t0Percent = totalTurns > 0 ? current.t0Turns / totalTurns : 0;

  const totalAiCost = current.aiCostCents / 100;
  const costPerSession =
    current.sessionsTotal > 0 ? totalAiCost / current.sessionsTotal : 0;
  const roi =
    totalAiCost > 0 ? current.upsellRevenue / totalAiCost : 0;

  const returningPercent =
    current.sessionsTotal > 0
      ? current.returningGuestSessions / current.sessionsTotal
      : 0;

  const topPerformers = [...current.nudgeRevenue.entries()]
    .map(([category, stats]) => ({
      category,
      accepted: stats.accepted,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    period,
    revenue: {
      total: current.revenueTotal,
      denisUpsell: current.upsellRevenue,
      upsellPercent:
        current.revenueTotal > 0
          ? (current.upsellRevenue / current.revenueTotal) * 100
          : 0,
      vsPrevious: pctChange(current.revenueTotal, previous.revenueTotal),
    },
    sessions: {
      total: current.sessionsTotal,
      converted: current.sessionsConverted,
      conversionRate,
      conversionVsPrevious: pctPointChange(conversionRate, prevConversionRate),
      avgOrderTimeSeconds,
      vsPrevious: pctChange(current.sessionsTotal, previous.sessionsTotal),
    },
    cost: {
      totalAiCost,
      costPerSession,
      t0Percent,
      roi,
    },
    guests: {
      returning: current.returningGuestSessions,
      returningPercent,
      avgVisitCount:
        current.returningGuestSessions > 0
          ? Math.round(
              (current.sessionsTotal / current.returningGuestSessions) * 10
            ) / 10
          : 0,
    },
    topPerformers,
    daily: current.daily.map((row) => ({
      date: row.date,
      revenue: row.revenue,
      sessions: row.sessions,
      conversionRate: row.sessions > 0 ? row.converted / row.sessions : 0,
    })),
  };
}

export function parseDenisRoiRange(
  params: AnalyticsSearchParams
): AnalyticsDateRange {
  const preset = params.preset ?? "30d";
  if (preset === "90d") {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 89);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { preset: "custom", start, end };
  }
  if (preset === "7d" || preset === "30d" || preset === "custom") {
    return resolveAnalyticsDateRange(params);
  }
  return resolveAnalyticsDateRange({ preset: "30d" });
}

export async function loadDenisRoiDailyRows(
  admin: SupabaseClient,
  locationId: string,
  fromDate: string,
  toDate: string
): Promise<ExperienceAnalyticsDailyRow[]> {
  const { data, error } = await admin
    .from("experience_analytics_daily" as never)
    .select(
      "metric_date, sessions_closed, session_revenue_total, converted_sessions, upsell_revenue_total, ai_cost_cents, t0_turns, llm_turns, returning_guest_sessions, order_time_seconds_total, by_nudge_revenue"
    )
    .eq("location_id", locationId)
    .gte("metric_date", fromDate)
    .lte("metric_date", toDate)
    .order("metric_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExperienceAnalyticsDailyRow[];
}

export async function fetchDenisRoiData(
  admin: SupabaseClient,
  input: {
    locationId: string;
    range: AnalyticsDateRange;
  }
): Promise<DenisRoiPayload> {
  const fromDate = formatAnalyticsIsoDate(input.range.start);
  const toDate = formatAnalyticsIsoDate(input.range.end);
  const previousRange = getPreviousAnalyticsRange(input.range);
  const prevFrom = formatAnalyticsIsoDate(previousRange.start);
  const prevTo = formatAnalyticsIsoDate(previousRange.end);

  const [currentRows, previousRows, experienceScore] = await Promise.all([
    loadDenisRoiDailyRows(admin, input.locationId, fromDate, toDate),
    loadDenisRoiDailyRows(admin, input.locationId, prevFrom, prevTo),
    loadExperienceScoreSnapshot(admin, { locationId: input.locationId }),
  ]);

  const current = aggregateDenisRoiRows(currentRows);
  const previous = aggregateDenisRoiRows(previousRows);

  return {
    ...buildDenisRoiData(current, previous, {
      start: fromDate,
      end: toDate,
    }),
    experienceScore,
  };
}

export function formatOrderDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder}s`;
}

export function formatRoiRatio(roi: number): string {
  if (!Number.isFinite(roi) || roi <= 0) return "—";
  return `${Math.round(roi)}:1`;
}
