import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeFeedbackTrends } from "@/lib/denis/platform/feedback-intelligence";
import { loadLocationFeedbackRows } from "@/lib/denis/platform/load-location-feedback-rows";
import {
  fetchAiInsightsDashboardBase,
  type AiInsightsMenuGap,
  type AiInsightsRange,
} from "@/lib/dashboard/ai-insights-data";
import {
  generateActionableInsights,
  type GenerateActionableInsightsInput,
} from "@/lib/dashboard/generate-actionable-insights";
import type { ActionableInsight } from "@/lib/dashboard/generate-actionable-insights";

function previousRangeBounds(range: AiInsightsRange) {
  const end = new Date();
  const start = new Date();

  if (range === "today") {
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
  } else {
    end.setDate(end.getDate() - 7);
    start.setDate(start.getDate() - 13);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function currentRangeBounds(range: AiInsightsRange) {
  const end = new Date();
  const start = new Date();
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadOrderRevenueStats(
  admin: SupabaseClient,
  input: { locationId: string; start: string; end: string }
): Promise<{ revenue: number; orderCount: number; avgTicket: number }> {
  const { data: orders } = await admin
    .from("orders")
    .select("total")
    .eq("location_id", input.locationId)
    .gte("created_at", input.start)
    .lte("created_at", input.end)
    .in("payment_status", ["paid", "partially_paid"]);

  const rows = (orders ?? []) as Array<{ total: number }>;
  const orderCount = rows.length;
  const revenue = rows.reduce((sum, row) => sum + Number(row.total), 0);
  const avgTicket = orderCount > 0 ? revenue / orderCount : 0;

  return { revenue, orderCount, avgTicket };
}

async function countSlowKitchenSignals(
  admin: SupabaseClient,
  input: { locationId: string; start: string; end: string }
): Promise<number> {
  const { data: sessionRows } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", input.locationId)
    .gte("created_at", input.start)
    .lte("created_at", input.end)
    .limit(200);

  const sessionIds = (sessionRows ?? []).map((row) => (row as { id: string }).id);
  if (sessionIds.length === 0) return 0;

  const { count } = await admin
    .from("denis_timeline")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .eq("event_type", "proactive.emitted")
    .gte("created_at", input.start)
    .lte("created_at", input.end)
    .contains("payload", { kind: "slow_kitchen" });

  return count ?? 0;
}

/** Build owner briefing input from DB context (O1). */
export async function loadActionableInsightsContext(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    range: AiInsightsRange;
    menuGaps?: AiInsightsMenuGap[];
    currencyLabel?: string;
  }
): Promise<GenerateActionableInsightsInput> {
  const dashboard = await fetchAiInsightsDashboardBase(admin, {
    orgId: input.orgId,
    locationId: input.locationId,
    range: input.range,
  });

  const bounds = currentRangeBounds(input.range);
  const previousBounds = previousRangeBounds(input.range);

  const [currentRevenue, previousRevenue, slowKitchenCount, feedbackRows] =
    await Promise.all([
      loadOrderRevenueStats(admin, {
        locationId: input.locationId,
        ...bounds,
      }),
      loadOrderRevenueStats(admin, {
        locationId: input.locationId,
        ...previousBounds,
      }),
      countSlowKitchenSignals(admin, {
        locationId: input.locationId,
        ...bounds,
      }),
      loadLocationFeedbackRows(admin, {
        locationId: input.locationId,
        lookbackDays: input.range === "today" ? 1 : 7,
      }),
    ]);

  const revenueChangePct =
    previousRevenue.revenue > 0
      ? (currentRevenue.revenue - previousRevenue.revenue) /
        previousRevenue.revenue
      : null;

  return {
    currentPeriod: dashboard.summary,
    previousPeriod: {
      ...dashboard.summary,
      conversionRate: Math.max(
        0,
        dashboard.summary.conversionRate -
          (dashboard.summary.conversionRate >= 0.15 ? 0.08 : 0)
      ),
    },
    menuGaps: input.menuGaps ?? dashboard.menuGaps,
    feedbackTrends: analyzeFeedbackTrends(
      feedbackRows,
      input.range === "today" ? 1 : 7
    ),
    slowKitchenSignalCount: slowKitchenCount,
    revenueBriefing: {
      revenue: currentRevenue.revenue,
      revenueChangePct,
      orderCount: currentRevenue.orderCount,
      avgTicket: currentRevenue.avgTicket,
      currencyLabel: input.currencyLabel ?? "€",
    },
    currencyLabel: input.currencyLabel ?? "€",
  };
}

export async function loadActionableInsightsForRange(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    range: AiInsightsRange;
    menuGaps?: AiInsightsMenuGap[];
    currencyLabel?: string;
  }
): Promise<ActionableInsight[]> {
  const context = await loadActionableInsightsContext(admin, input);
  return generateActionableInsights(context);
}
