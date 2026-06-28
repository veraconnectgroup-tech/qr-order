import type { SupabaseClient } from "@supabase/supabase-js";
import { subDays } from "date-fns";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { extractThresholdNudgeOutcomes } from "@/lib/denis/runtime/extract-threshold-nudge-outcomes";
import {
  buildThresholdConversionSeries,
  buildThresholdRecommendationSummary,
  formatThresholdDigestSection,
  formatThresholdOwnerSuggestion,
  optimizeThresholds,
  suggestThresholdChanges,
  type ThresholdConversionSeries,
  type ThresholdMetric,
} from "@/lib/denis/learning/threshold-optimizer";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";

export type ThresholdOptimizationSnapshot = {
  locationId: string;
  periodDays: number;
  autoApply: boolean;
  metrics: ThresholdMetric[];
  suggestions: ThresholdMetric[];
  ownerSuggestions: string[];
  conversionSeries: ThresholdConversionSeries[];
  digestLines: string[];
  summary: string | null;
};

const SESSION_LIMIT = 120;

function currentThresholdsFromConfig(
  config: ConciergeConfig
): Record<string, number> {
  return {
    browseNudgeMinutes: config.proactive.browseNudgeMinutes,
    dessertDelayMinutes: config.upsell.dessertDelayMinutes,
    billPromptMinutes: config.proactive.billPromptMinutes,
    slowKitchenThresholdMinutes: config.proactive.slowKitchenThresholdMinutes,
  };
}

export async function loadThresholdOptimizationSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    config: ConciergeConfig;
    periodDays?: number;
  }
): Promise<ThresholdOptimizationSnapshot> {
  const periodDays = input.periodDays ?? 14;
  const since = subDays(new Date(), periodDays).toISOString();

  const { data: sessionRows } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", input.locationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(SESSION_LIMIT);

  const sessionIds = ((sessionRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id
  );

  const timelines = await Promise.all(
    sessionIds.map((aiSessionId) => loadDenisTimeline(admin, aiSessionId))
  );

  const nudgeOutcomes = extractThresholdNudgeOutcomes(timelines);
  const currentThresholds = currentThresholdsFromConfig(input.config);
  const metrics = optimizeThresholds({
    nudgeOutcomes,
    lookbackDays: periodDays,
    currentThresholds,
  });
  const suggestions = suggestThresholdChanges(metrics);
  const conversionSeries = buildThresholdConversionSeries({
    nudgeOutcomes,
    currentThresholds,
  });

  return {
    locationId: input.locationId,
    periodDays,
    autoApply: input.config.thresholdOptimizer.autoApply,
    metrics,
    suggestions,
    ownerSuggestions: suggestions.map((row) => formatThresholdOwnerSuggestion(row)),
    conversionSeries,
    digestLines: formatThresholdDigestSection(metrics),
    summary: buildThresholdRecommendationSummary(metrics),
  };
}
