import { subDays, format } from "date-fns";
import { aggregateProductNudgeStatsFromTimelines } from "@/lib/denis/learning/aggregate-product-nudge-stats";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { computeConversionRate } from "@/lib/operator/projections/helpers";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NudgePerformanceSnapshot = {
  locationId: string;
  locationName: string;
  periodDays: number;
  fromDate: string;
  toDate: string;
  nudgeImpressions: number;
  offerConversions: number;
  conversionRate: number;
  nudgeDeclined: number;
  nudgeIgnored: number;
  nudgeExpired: number;
  byNudgeKind: Record<string, number>;
  byOutcome: Record<string, number>;
  topProducts: Array<{
    productId: string;
    productName: string;
    impressions: number;
    accepts: number;
    acceptRate: number;
  }>;
  suggestedAction: string | null;
};

const TIMELINE_SESSION_LIMIT = 150;

function mergeCountMaps(
  target: Record<string, number>,
  source: Record<string, number> | null | undefined
): void {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function buildSuggestedAction(input: {
  conversionRate: number;
  nudgeImpressions: number;
  topProducts: NudgePerformanceSnapshot["topProducts"];
  byOutcome: Record<string, number>;
}): string | null {
  if (input.nudgeImpressions < 10) {
    return "Premalo podataka — Denis treba još sesija pre preporuke.";
  }

  const top = input.topProducts[0];
  if (top && top.acceptRate >= 0.35 && top.impressions >= 5) {
    return `Nastavi browse nudge za „${top.productName}" (${Math.round(top.acceptRate * 100)}% accept).`;
  }

  const declined = input.byOutcome.declined ?? 0;
  const ignored = input.byOutcome.ignored ?? 0;
  if (declined + ignored > input.nudgeImpressions * 0.5) {
    return "Više od polovine nudge-ova odbijeno/ignorisano — razmotri smanjenje frekvencije.";
  }

  if (input.conversionRate < 0.1) {
    return "Nizak accept rate — proveri da li su proizvodi u nudge-u kitchen-ready i da li je GMM u enforce modu.";
  }

  return null;
}

export async function loadNudgePerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    periodDays?: number;
  }
): Promise<NudgePerformanceSnapshot | null> {
  const periodDays = input.periodDays ?? 7;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");

  const { data: locationRow } = await admin
    .from("locations")
    .select("id, name")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  const { data: rollupRows, error: rollupError } = await admin
    .from("experience_analytics_daily" as never)
    .select(
      "nudge_impressions, offer_conversions, nudge_declined, nudge_ignored, nudge_expired, by_nudge_kind, by_outcome"
    )
    .eq("location_id", input.locationId)
    .gte("metric_date", fromDate)
    .lte("metric_date", toDate);

  if (rollupError) {
    logger.warn("loadNudgePerformanceSnapshot rollup failed", {
      locationId: input.locationId,
      error: rollupError.message,
    });
    return null;
  }

  const rows = (rollupRows ?? []) as Array<{
    nudge_impressions: number;
    offer_conversions: number;
    nudge_declined: number;
    nudge_ignored: number;
    nudge_expired: number;
    by_nudge_kind: Record<string, number>;
    by_outcome: Record<string, number>;
  }>;

  let nudgeImpressions = 0;
  let offerConversions = 0;
  let nudgeDeclined = 0;
  let nudgeIgnored = 0;
  let nudgeExpired = 0;
  const byNudgeKind: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};

  for (const row of rows) {
    nudgeImpressions += row.nudge_impressions ?? 0;
    offerConversions += row.offer_conversions ?? 0;
    nudgeDeclined += row.nudge_declined ?? 0;
    nudgeIgnored += row.nudge_ignored ?? 0;
    nudgeExpired += row.nudge_expired ?? 0;
    mergeCountMaps(byNudgeKind, row.by_nudge_kind);
    mergeCountMaps(byOutcome, row.by_outcome);
  }

  const since = subDays(new Date(), periodDays).toISOString();
  const { data: sessionRows } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", input.locationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(TIMELINE_SESSION_LIMIT);

  const timelines = [];
  for (const row of (sessionRows ?? []) as Array<{ id: string }>) {
    timelines.push(await loadDenisTimeline(admin, row.id));
  }

  const productStats = aggregateProductNudgeStatsFromTimelines(timelines);
  const productIds = productStats.map((row) => row.productId);

  const productNames: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await admin
      .from("products")
      .select("id, name")
      .in("id", productIds);

    for (const product of (products ?? []) as Array<{ id: string; name: string }>) {
      productNames[product.id] = product.name;
    }
  }

  const topProducts = productStats.slice(0, 8).map((row) => ({
    productId: row.productId,
    productName: productNames[row.productId] ?? row.productName ?? "—",
    impressions: row.impressions,
    accepts: row.accepts,
    acceptRate: row.acceptRate,
  }));

  const conversionRate = computeConversionRate(nudgeImpressions, offerConversions);

  return {
    locationId: input.locationId,
    locationName: (locationRow as { name: string }).name,
    periodDays,
    fromDate,
    toDate,
    nudgeImpressions,
    offerConversions,
    conversionRate,
    nudgeDeclined,
    nudgeIgnored,
    nudgeExpired,
    byNudgeKind,
    byOutcome,
    topProducts,
    suggestedAction: buildSuggestedAction({
      conversionRate,
      nudgeImpressions,
      topProducts,
      byOutcome,
    }),
  };
}
