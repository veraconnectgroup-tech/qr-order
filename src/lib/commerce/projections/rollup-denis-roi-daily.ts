import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { metricDateFromIso } from "@/lib/commerce/projections/rollup-anticipation-analytics";

/** Approximate EUR cost per Denis credit for ROI rollup (€0.04). */
export const DENIS_CREDIT_COST_CENTS = 4;

/** Estimated LLM tokens per Denis turn when metering has no tokenUsage. */
export const ESTIMATED_TOKENS_PER_LLM_TURN = 720;

export type RoiImpactDailyCounters = {
  waiter_calls_saved?: number;
  kitchen_delay_prevented?: number;
  allergy_catches?: number;
  review_clicks?: number;
  tokens_total?: number;
};

type AdminClient = SupabaseClient<Database>;
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

export function mergeRoiImpactMaps(
  a: RoiImpactDailyCounters,
  b: RoiImpactDailyCounters
): RoiImpactDailyCounters {
  const next: RoiImpactDailyCounters = { ...a };
  for (const key of Object.keys(b) as Array<keyof RoiImpactDailyCounters>) {
    const delta = b[key] ?? 0;
    if (!delta) continue;
    next[key] = (next[key] ?? 0) + delta;
  }
  return next;
}

export function roiImpactDelta(
  field: keyof RoiImpactDailyCounters,
  amount = 1
): RoiImpactDailyCounters {
  return { [field]: amount };
}

export type DenisTurnDailyRollupInput = {
  orgId: string;
  locationId: string;
  createdAt: string;
  llmUsed: boolean;
  creditsCharged: number;
  promptTokens?: number;
  completionTokens?: number;
  waiterCallDeflected?: boolean;
};

export function denisTurnDailyDelta(input: DenisTurnDailyRollupInput): {
  metricDate: string;
  t0Turns: number;
  llmTurns: number;
  totalTurns: number;
  aiCostCents: number;
  roiImpact: RoiImpactDailyCounters;
} {
  const llmTurns = input.llmUsed ? 1 : 0;
  const t0Turns = input.llmUsed ? 0 : 1;
  const credits = Math.max(0, input.creditsCharged);
  const tokens =
    (input.promptTokens ?? 0) + (input.completionTokens ?? 0) ||
    (llmTurns > 0 ? ESTIMATED_TOKENS_PER_LLM_TURN : 0);

  const roiImpact: RoiImpactDailyCounters = {
    tokens_total: tokens,
  };

  if (input.waiterCallDeflected || t0Turns > 0) {
    roiImpact.waiter_calls_saved = 1;
  }

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
    roiImpact,
  };
}

export async function upsertDenisTurnDailyRollup(
  admin: AdminClient,
  input: DenisTurnDailyRollupInput
): Promise<void> {
  const delta = denisTurnDailyDelta(input);

  const { data: existing, error: readError } = await admin
    .from("experience_analytics_daily")
    .select("t0_turns, llm_turns, total_turns, ai_cost_cents, by_roi_impact")
    .eq("location_id", input.locationId)
    .eq("metric_date", delta.metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const existingImpact =
    (existing?.by_roi_impact as RoiImpactDailyCounters | null) ?? {};

  const { error: upsertError } = await admin
    .from("experience_analytics_daily")
    .upsert(
      {
        org_id: input.orgId,
        location_id: input.locationId,
        metric_date: delta.metricDate,
        t0_turns: (existing?.t0_turns ?? 0) + delta.t0Turns,
        llm_turns: (existing?.llm_turns ?? 0) + delta.llmTurns,
        total_turns: (existing?.total_turns ?? 0) + delta.totalTurns,
        ai_cost_cents: (existing?.ai_cost_cents ?? 0) + delta.aiCostCents,
        by_roi_impact: mergeRoiImpactMaps(
          existingImpact,
          delta.roiImpact
        ) as Json,
        updated_at: new Date().toISOString(),
      },
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
  admin: AdminClient,
  input: OfferUpsellRollupInput
): Promise<void> {
  const metricDate = format(new Date(input.createdAt), "yyyy-MM-dd");
  const revenue = Math.max(0, input.revenue);
  const category = input.nudgeKind.trim() || "unknown";
  const deltaMap = mergeNudgeRevenue({}, category, revenue);

  const { data: existing, error: readError } = await admin
    .from("experience_analytics_daily")
    .select("upsell_revenue_total, by_nudge_revenue")
    .eq("location_id", input.locationId)
    .eq("metric_date", metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const existingRevenue = existing?.by_nudge_revenue as NudgeRevenueMap | null;

  const { error: upsertError } = await admin
    .from("experience_analytics_daily")
    .upsert(
      {
        org_id: input.orgId,
        location_id: input.locationId,
        metric_date: metricDate,
        upsell_revenue_total:
          Number(existing?.upsell_revenue_total ?? 0) + revenue,
        by_nudge_revenue: mergeNudgeRevenueMaps(
          existingRevenue ?? {},
          deltaMap
        ) as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "location_id,metric_date" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export type RoiImpactRollupInput = {
  orgId: string;
  locationId: string;
  createdAt: string;
  delta: RoiImpactDailyCounters;
};

/** Increment ROI savings counters (allergy catch, kitchen delay, review click, …). */
export async function upsertRoiImpactDailyRollup(
  admin: AdminClient,
  input: RoiImpactRollupInput
): Promise<void> {
  const metricDate = metricDateFromIso(input.createdAt);

  const { data: existing, error: readError } = await admin
    .from("experience_analytics_daily")
    .select("by_roi_impact")
    .eq("location_id", input.locationId)
    .eq("metric_date", metricDate)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const prior = (existing?.by_roi_impact as RoiImpactDailyCounters | null) ?? {};

  const { error: upsertError } = await admin
    .from("experience_analytics_daily")
    .upsert(
      {
        org_id: input.orgId,
        location_id: input.locationId,
        metric_date: metricDate,
        by_roi_impact: mergeRoiImpactMaps(prior, input.delta) as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "location_id,metric_date" }
    );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export { mergeNudgeRevenue, mergeNudgeRevenueMaps };
