import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  computeSessionCheckEuros,
  deriveCheckTier,
  type CheckTier,
  type RevenueInsight,
  type RevenueStrategy,
} from "@/lib/denis/config/revenue-intelligence";

export {
  computeRevenueInsight,
  computeSessionCheckEuros,
  deriveCheckTier,
  formatRevenueInsightEvidence,
  revenueCheckTierPriorityBoost,
  revenueStrategyPriorityBoost,
  shouldOfferFoodUpsellForRevenue,
  shouldSkipDessertForRevenueStrategy,
  shouldSuppressUpsellForHighCheck,
  staffCopilotRevenueHint,
  staffCopilotTableRevenueHint,
  type CheckTier,
  type RevenueInsight,
  type RevenueStrategy,
} from "@/lib/denis/config/revenue-intelligence";

export type TableSessionRevenueRow = {
  tableLabel: string;
  sessionRevenueEuros: number;
  upsellRevenueEuros: number;
};

export type DailyRevenueIntelligenceReport = {
  avgOrderEuros: number;
  avgOrderVsLastWeekPct: number;
  denisUpsellContributionEuros: number;
  lowPerformingTableLabels: string[];
};

function pctChange(current: number, baseline: number): number {
  if (baseline <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - baseline) / baseline) * 1000) / 10;
}

/** Lowest-revenue sessions with zero Denis upsell attribution — staff review list. */
export function identifyLowPerformingTableLabels(
  sessions: TableSessionRevenueRow[],
  options?: { maxResults?: number }
): string[] {
  const max = options?.maxResults ?? 5;
  return sessions
    .filter(
      (row) =>
        row.sessionRevenueEuros > 0 &&
        row.upsellRevenueEuros <= 0 &&
        row.tableLabel.trim().length > 0
    )
    .sort((a, b) => a.sessionRevenueEuros - b.sessionRevenueEuros)
    .slice(0, max)
    .map((row) => row.tableLabel.trim());
}

export function buildDailyRevenueIntelligenceReport(input: {
  orderCount: number;
  revenueTotalEuros: number;
  revenueLastWeekSameDayEuros: number;
  denisUpsellEuros: number;
  tableSessions?: TableSessionRevenueRow[];
}): DailyRevenueIntelligenceReport {
  const orderCount = Math.max(0, input.orderCount);
  const avgOrderEuros =
    orderCount > 0
      ? Math.round((input.revenueTotalEuros / orderCount) * 100) / 100
      : 0;
  const lastWeekOrderCount = orderCount;
  const lastWeekAvg =
    lastWeekOrderCount > 0
      ? input.revenueLastWeekSameDayEuros / lastWeekOrderCount
      : 0;

  return {
    avgOrderEuros,
    avgOrderVsLastWeekPct: pctChange(avgOrderEuros, lastWeekAvg),
    denisUpsellContributionEuros: Math.round(input.denisUpsellEuros * 100) / 100,
    lowPerformingTableLabels: identifyLowPerformingTableLabels(
      input.tableSessions ?? []
    ),
  };
}

export function formatDailyRevenueIntelligenceLines(
  report: DailyRevenueIntelligenceReport
): string[] {
  const lines = [
    `Prosečna narudžbina: €${report.avgOrderEuros.toFixed(2)} (${report.avgOrderVsLastWeekPct >= 0 ? "+" : ""}${report.avgOrderVsLastWeekPct}% vs prošla nedelja)`,
    `Denis upsell doprinos: €${report.denisUpsellContributionEuros.toFixed(0)} danas`,
  ];

  if (report.lowPerformingTableLabels.length > 0) {
    lines.push(
      `Najjeftiniji stolovi: [${report.lowPerformingTableLabels.join(", ")}] — Denis nije uspešno upsell-ovao`
    );
  }

  return lines;
}

export function resolveTableRevenuePosture(input: {
  orders: AiGuestOrder[];
  revenueInsight: RevenueInsight | null | undefined;
}): {
  checkEuros: number;
  checkTier: CheckTier;
  strategy: RevenueStrategy | null;
} {
  const checkEuros = computeSessionCheckEuros(input.orders);
  return {
    checkEuros,
    checkTier: deriveCheckTier(checkEuros),
    strategy: input.revenueInsight?.strategy ?? null,
  };
}
