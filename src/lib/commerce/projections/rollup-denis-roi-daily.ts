import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { metricDateFromIso } from "@/lib/commerce/projections/rollup-anticipation-analytics";

/** Approximate EUR cost per Denis credit for ROI rollup (€0.04). */
export const DENIS_CREDIT_COST_CENTS = 4;

type NudgeRevenueMap = Record<string, { accepted?: number; revenue?: number }>;

function mergeNudgeRevenue(
  base: NudgeRevenueMap,
  category: string,
  revenue: number
): NudgeRevenueMap {
  const next = { ...base };
  const existing = next[category] ?? { accepted: 0, revenue: 0 };
  next[category] = {
    accepted: (existing.accepted ?? 0) + 1,
    revenue: Number(existing.revenue ?? 0) + revenue,
  };
  return next;
}

function mergeNudgeRevenueMaps(
  a: NudgeRevenueMap,
  b: NudgeRevenueMap
): NudgeRevenueMap {
  const next: NudgeRevenueMap = { ...a };
  for (const [category, stats] of Object.entries(b)) {
    next[category] = {
      accepted: (next[category]?.accepted ?? 0) + (stats.accepted ?? 0),
      revenue: Number(next[category]?.revenue ?? 0) + Number(stats.revenue ?? 0),
    };
  }
  return next;
}

export type DenisTurnDailyRollupInput = {
  orgId: string;
  locationId: string;
  createdAt: string;
  llmUsed: boolean;
  creditsCharged: number;
};

export function denisTurnDailyDelta(input: DenisTurnDailyRollupInput): {
  metricDate: string;
  t0Turns: number;
  llmTurns: number;
  totalTurns: number;
  aiCostCents: number;
} {
  const llmTurns = input.llmUsed ? 1 : 0;
  const t0Turns = input.llmUsed ? 0 : 1;
  const credits = Math.max(0, input.creditsCharged);
  return {
    metricDate: metricDateFromIso(input.createdAt),
    t0Turns,
    llmTurns,
    totalTurns: 1,
    aiCostCents:
      credits > 0
        ? Math.round(credits * DENIS_CREDIT_COST_CENTS)
        : llmTurns > 0
          ? DENIS_CREDIT_COST_CENTS
          : 0,
  };
}

export async function upsertDenisTurnDailyRollup(
  admin: SupabaseClient,
  input: DenisTurnDailyRollupInput
): Promise<void> {
  const delta = denisTurnDailyDelta(input);

  const { data: existing, error: readError } = await admin
    .from("experience_analytics_daily" as never)
    .select("t0_turns, llm_turns, total_turns, ai_cost_cents")
    .eq("location_id", input.locationId)
    .eq("metric_date", delta.metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const row = existing as {
    t0_turns?: number;
    llm_turns?: number;
    total_turns?: number;
    ai_cost_cents?: number;
  } | null;

  const { error: upsertError } = await admin
    .from("experience_analytics_daily" as never)
    .upsert(
      {
        org_id: input.orgId,
        location_id: input.locationId,
        metric_date: delta.metricDate,
        t0_turns: (row?.t0_turns ?? 0) + delta.t0Turns,
        llm_turns: (row?.llm_turns ?? 0) + delta.llmTurns,
        total_turns: (row?.total_turns ?? 0) + delta.totalTurns,
        ai_cost_cents: (row?.ai_cost_cents ?? 0) + delta.aiCostCents,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id,metric_date" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export type OfferUpsellRollupInput = {
  orgId: string;
  locationId: string;
  createdAt: string;
  nudgeKind: string;
  revenue: number;
};

export async function upsertOfferUpsellDailyRollup(
  admin: SupabaseClient,
  input: OfferUpsellRollupInput
): Promise<void> {
  const metricDate = format(new Date(input.createdAt), "yyyy-MM-dd");
  const revenue = Math.max(0, input.revenue);
  const category = input.nudgeKind.trim() || "unknown";
  const deltaMap = mergeNudgeRevenue({}, category, revenue);

  const { data: existing, error: readError } = await admin
    .from("experience_analytics_daily" as never)
    .select("upsell_revenue_total, by_nudge_revenue")
    .eq("location_id", input.locationId)
    .eq("metric_date", metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const row = existing as {
    upsell_revenue_total?: number;
    by_nudge_revenue?: NudgeRevenueMap;
  } | null;

  const { error: upsertError } = await admin
    .from("experience_analytics_daily" as never)
    .upsert(
      {
        org_id: input.orgId,
        location_id: input.locationId,
        metric_date: metricDate,
        upsell_revenue_total:
          Number(row?.upsell_revenue_total ?? 0) + revenue,
        by_nudge_revenue: mergeNudgeRevenueMaps(
          row?.by_nudge_revenue ?? {},
          deltaMap
        ),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id,metric_date" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export { mergeNudgeRevenue, mergeNudgeRevenueMaps };
