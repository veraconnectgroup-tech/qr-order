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
import {
  ESTIMATED_TOKENS_PER_LLM_TURN,
  type RoiImpactDailyCounters,
} from "@/lib/commerce/projections/rollup-denis-roi-daily";
import {
  buildDailyRevenueIntelligenceReport,
  type TableSessionRevenueRow,
} from "@/lib/denis/learning/revenue-intelligence";
import {
  aggregateTipAnalytics,
  type TipAnalyticsSnapshot,
  type TipOrderRow,
} from "@/lib/denis/commerce/smart-tips";

/** Minutes of waiter floor time saved per Denis deflection (T0 / self-serve). */
export const WAITER_MINUTES_SAVED_PER_DEFLECTION = 2.5;

/** Typical waiter labor cost per guest interaction (≈3 min @ €13/h). */
export const ESTIMATED_WAITER_COST_PER_INTERACTION_EUR = 0.65;

export type DenisRoiRange = "7d" | "30d" | "90d" | "custom";

export type DenisRoiData = {
  period: { start: string; end: string };
  revenue: {
    total: number;
    denisUpsell: number;
    upsellPercent: number;
    vsPrevious: number;
    upsellRevenue: number;
    savedOrders: { count: number; revenue: number };
    avgOrderIncreasePct: number;
  };
  savings: {
    waiterCallsSaved: number;
    waiterHoursSaved: number;
    kitchenDelayPrevented: number;
    allergyCatches: number;
  };
  satisfaction: {
    experienceScoreAvg: number | null;
    reviewConversionRate: number;
    returnRate: number;
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
    tokensPerSession: number;
    denisVsWaiterRatio: number;
    breakEvenUpsellsPerDay: number;
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
    upsellRevenue: number;
    sessions: number;
    conversionRate: number;
    experienceScore: number | null;
  }[];
  revenueIntelligence: {
    avgOrderValue: number;
    avgOrderVsPreviousPct: number;
    denisUpsellContribution: number;
    lowPerformingTableLabels: string[];
  };
  tips: TipAnalyticsSnapshot & {
    avgTipVsPreviousPct: number;
  };
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
  offer_conversions?: number;
  experience_score?: number | null;
  by_roi_impact?: RoiImpactDailyCounters;
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
  offerConversions: number;
  roiImpact: RoiImpactDailyCounters;
  nudgeRevenue: Map<string, { accepted: number; revenue: number }>;
  daily: Array<{
    date: string;
    revenue: number;
    upsellRevenue: number;
    sessions: number;
    converted: number;
    experienceScore: number | null;
  }>;
};

function mergeRoiImpact(
  target: RoiImpactDailyCounters,
  source: RoiImpactDailyCounters | undefined
): void {
  if (!source) return;
  for (const key of Object.keys(source) as Array<keyof RoiImpactDailyCounters>) {
    const delta = source[key] ?? 0;
    if (!delta) continue;
    target[key] = (target[key] ?? 0) + delta;
  }
}

export function sumRoiImpact(rows: RoiImpactDailyCounters[]): RoiImpactDailyCounters {
  const total: RoiImpactDailyCounters = {};
  for (const row of rows) {
    mergeRoiImpact(total, row);
  }
  return total;
}

export function deriveWaiterHoursSaved(waiterCallsSaved: number): number {
  return (
    Math.round(((waiterCallsSaved * WAITER_MINUTES_SAVED_PER_DEFLECTION) / 60) * 10) /
    10
  );
}

export function deriveDenisVsWaiterRatio(costPerSession: number): number {
  if (costPerSession <= 0) return 0;
  return (
    Math.round(
      (ESTIMATED_WAITER_COST_PER_INTERACTION_EUR / costPerSession) * 10
    ) / 10
  );
}

export function deriveBreakEvenUpsellsPerDay(input: {
  costPerSession: number;
  avgUpsellValue: number;
  sessionsPerDay: number;
}): number {
  if (input.avgUpsellValue <= 0 || input.sessionsPerDay <= 0) return 0;
  const dailyAiCost = input.costPerSession * input.sessionsPerDay;
  return Math.max(1, Math.ceil(dailyAiCost / input.avgUpsellValue));
}

export function nudgeCategoryStats(
  nudgeRevenue: Map<string, { accepted: number; revenue: number }>,
  category: string
): { accepted: number; revenue: number } {
  return nudgeRevenue.get(category) ?? { accepted: 0, revenue: 0 };
}

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
  let offerConversions = 0;
  const roiImpact: RoiImpactDailyCounters = {};

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
    offerConversions += row.offer_conversions ?? 0;
    mergeNudgeRevenue(nudgeRevenue, row.by_nudge_revenue);
    mergeRoiImpact(roiImpact, row.by_roi_impact);

    daily.push({
      date: row.metric_date,
      revenue,
      upsellRevenue: upsell,
      sessions,
      converted,
      experienceScore:
        row.experience_score != null ? Number(row.experience_score) : null,
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
    offerConversions,
    roiImpact,
    nudgeRevenue,
    daily,
  };
}

export function buildDenisRoiData(
  current: DenisRoiAggregates,
  previous: DenisRoiAggregates,
  period: { start: string; end: string },
  options?: {
    tableSessions?: TableSessionRevenueRow[];
    tipOrders?: TipOrderRow[];
    previousTipOrders?: TipOrderRow[];
  }
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

  const avgOrderValue =
    current.sessionsConverted > 0
      ? Math.round((current.revenueTotal / current.sessionsConverted) * 100) / 100
      : 0;
  const prevAvgOrderValue =
    previous.sessionsConverted > 0
      ? previous.revenueTotal / previous.sessionsConverted
      : 0;

  const revenueIntelligenceReport = buildDailyRevenueIntelligenceReport({
    orderCount: current.sessionsConverted,
    revenueTotalEuros: current.revenueTotal,
    revenueLastWeekSameDayEuros: previous.revenueTotal,
    denisUpsellEuros: current.upsellRevenue,
    tableSessions: options?.tableSessions ?? [],
  });

  const cartRecovery = nudgeCategoryStats(current.nudgeRevenue, "cart_recovery");
  const avgOrderIncreasePct = pctChange(avgOrderValue, prevAvgOrderValue);

  const waiterCallsSaved =
    current.roiImpact.waiter_calls_saved ??
    Math.round(current.t0Turns * 0.35 + current.llmTurns * 0.08);
  const kitchenDelayPrevented =
    current.roiImpact.kitchen_delay_prevented ??
    nudgeCategoryStats(current.nudgeRevenue, "kitchen_busy").accepted;
  const allergyCatches =
    current.roiImpact.allergy_catches ??
    Math.round(current.sessionsTotal * 0.01);
  const reviewClicks = current.roiImpact.review_clicks ?? 0;

  const tokensTotal =
    current.roiImpact.tokens_total ??
    current.llmTurns * ESTIMATED_TOKENS_PER_LLM_TURN;
  const tokensPerSession =
    current.sessionsTotal > 0
      ? Math.round(tokensTotal / current.sessionsTotal)
      : 0;

  const denisVsWaiterRatio = deriveDenisVsWaiterRatio(costPerSession);

  const periodDays = Math.max(1, current.daily.length);
  const sessionsPerDay = current.sessionsTotal / periodDays;
  const avgUpsellValue =
    cartRecovery.accepted > 0
      ? cartRecovery.revenue / cartRecovery.accepted
      : current.upsellRevenue > 0 && current.sessionsConverted > 0
        ? current.upsellRevenue / Math.max(1, current.sessionsConverted * 0.15)
        : 4;

  const breakEvenUpsellsPerDay = deriveBreakEvenUpsellsPerDay({
    costPerSession,
    avgUpsellValue,
    sessionsPerDay,
  });

  const experienceScores = current.daily
    .map((row) => row.experienceScore)
    .filter((score): score is number => score != null);
  const experienceScoreAvg =
    experienceScores.length > 0
      ? Math.round(
          (experienceScores.reduce((sum, score) => sum + score, 0) /
            experienceScores.length) *
            10
        ) / 10
      : null;

  const reviewConversionRate =
    current.sessionsTotal > 0
      ? (reviewClicks > 0
          ? reviewClicks
          : current.offerConversions * 0.12) / current.sessionsTotal
      : 0;

  const tipAnalytics = aggregateTipAnalytics(options?.tipOrders ?? []);
  const previousTipAnalytics = aggregateTipAnalytics(
    options?.previousTipOrders ?? []
  );

  return {
    period,
    revenue: {
      total: current.revenueTotal,
      denisUpsell: current.upsellRevenue,
      upsellRevenue: current.upsellRevenue,
      upsellPercent:
        current.revenueTotal > 0
          ? (current.upsellRevenue / current.revenueTotal) * 100
          : 0,
      vsPrevious: pctChange(current.revenueTotal, previous.revenueTotal),
      savedOrders: {
        count: cartRecovery.accepted,
        revenue: cartRecovery.revenue,
      },
      avgOrderIncreasePct,
    },
    savings: {
      waiterCallsSaved,
      waiterHoursSaved: deriveWaiterHoursSaved(waiterCallsSaved),
      kitchenDelayPrevented,
      allergyCatches,
    },
    satisfaction: {
      experienceScoreAvg,
      reviewConversionRate,
      returnRate: returningPercent,
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
      tokensPerSession,
      denisVsWaiterRatio,
      breakEvenUpsellsPerDay,
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
      upsellRevenue: row.upsellRevenue,
      sessions: row.sessions,
      conversionRate: row.sessions > 0 ? row.converted / row.sessions : 0,
      experienceScore: row.experienceScore,
    })),
    revenueIntelligence: {
      avgOrderValue,
      avgOrderVsPreviousPct: pctChange(avgOrderValue, prevAvgOrderValue),
      denisUpsellContribution: current.upsellRevenue,
      lowPerformingTableLabels: revenueIntelligenceReport.lowPerformingTableLabels,
    },
    tips: {
      ...tipAnalytics,
      avgTipVsPreviousPct: pctChange(
        tipAnalytics.avgTipPercent,
        previousTipAnalytics.avgTipPercent
      ),
    },
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
      "metric_date, sessions_closed, session_revenue_total, converted_sessions, upsell_revenue_total, ai_cost_cents, t0_turns, llm_turns, returning_guest_sessions, order_time_seconds_total, by_nudge_revenue, offer_conversions, experience_score, by_roi_impact"
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

type TableSessionRevenueQueryRow = {
  id: string;
  table: { name: string } | { name: string }[] | null;
  orders: Array<{ total: number | string }> | null;
};

export async function loadTableSessionRevenueRows(
  admin: SupabaseClient,
  locationId: string,
  metricDate: string
): Promise<TableSessionRevenueRow[]> {
  const dayStart = `${metricDate}T00:00:00.000Z`;
  const dayEnd = `${metricDate}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("table_sessions")
    .select("id, table:tables(name), orders(total)")
    .eq("location_id", locationId)
    .gte("opened_at", dayStart)
    .lte("opened_at", dayEnd);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as TableSessionRevenueQueryRow[]).map((row) => {
    const tableRel = row.table;
    const tableName = Array.isArray(tableRel)
      ? tableRel[0]?.name ?? "—"
      : tableRel?.name ?? "—";
    const sessionRevenueEuros = (row.orders ?? []).reduce(
      (sum, order) => sum + Number(order.total ?? 0),
      0
    );

    return {
      tableLabel: tableName,
      sessionRevenueEuros: Math.round(sessionRevenueEuros * 100) / 100,
      upsellRevenueEuros: 0,
    };
  });
}

export async function loadTipOrderRows(
  admin: SupabaseClient,
  locationId: string,
  fromDate: string,
  toDate: string
): Promise<TipOrderRow[]> {
  const dayStart = `${fromDate}T00:00:00.000Z`;
  const dayEnd = `${toDate}T23:59:59.999Z`;

  const { data, error } = await admin
    .from("orders")
    .select("tip_amount, total, created_at")
    .eq("location_id", locationId)
    .gt("tip_amount", 0)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const order = row as {
      tip_amount: number | string;
      total: number | string;
      created_at: string;
    };
    return {
      tipAmount: Number(order.tip_amount ?? 0),
      orderTotal: Number(order.total ?? 0),
      createdAt: order.created_at,
    };
  });
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

  const [currentRows, previousRows, experienceScore, tableSessions, tipOrders, previousTipOrders] =
    await Promise.all([
      loadDenisRoiDailyRows(admin, input.locationId, fromDate, toDate),
      loadDenisRoiDailyRows(admin, input.locationId, prevFrom, prevTo),
      loadExperienceScoreSnapshot(admin, { locationId: input.locationId }),
      loadTableSessionRevenueRows(admin, input.locationId, toDate),
      loadTipOrderRows(admin, input.locationId, fromDate, toDate),
      loadTipOrderRows(admin, input.locationId, prevFrom, prevTo),
    ]);

  const current = aggregateDenisRoiRows(currentRows);
  const previous = aggregateDenisRoiRows(previousRows);

  return {
    ...buildDenisRoiData(current, previous, {
      start: fromDate,
      end: toDate,
    }, { tableSessions, tipOrders, previousTipOrders }),
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

export function formatCostPerSession(costPerSession: number): string {
  return `€${costPerSession.toFixed(2)}`;
}

export function formatWaiterHoursSaved(hours: number): string {
  if (hours <= 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${hours.toFixed(1)}h`;
}

export function formatRoiRatio(roi: number): string {
  if (!Number.isFinite(roi) || roi <= 0) return "—";
  return `${Math.round(roi)}:1`;
}
