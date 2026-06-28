import { subDays, format } from "date-fns";
import {
  analyzeInterventionJournal,
  type InterventionJournalInsight,
} from "@/lib/denis/platform/intervention-intelligence";
import { COMMERCE_EVENT_TYPES } from "@/lib/commerce/event-types";
import { resolveInterventionManifestVersion } from "@/lib/denis/cognition/intervention/resolve-intervention-manifest";
import {
  resolveInterventionConfiguredMode,
  resolveInterventionMode,
} from "@/lib/denis/config/resolve-intervention-mode";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InterventionJournalSnapshot = InterventionJournalInsight & {
  locationId: string;
  locationName: string;
  periodDays: number;
  fromDate: string;
  toDate: string;
  mode: string;
  configuredMode: string;
  manifestVersion: string;
  journalActive: boolean;
};

function mergeCountMaps(
  target: Record<string, number>,
  source: Record<string, number> | null | undefined
): void {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + value;
  }
}

async function loadRuleFireCounts(
  admin: SupabaseClient,
  input: { locationId: string; sinceIso: string }
): Promise<Record<string, number>> {
  const { data, error } = await admin
    .from("commerce_experience_events" as never)
    .select("payload")
    .eq("location_id", input.locationId)
    .eq("event_type", COMMERCE_EVENT_TYPES.interventionEvaluated)
    .gte("created_at", input.sinceIso)
    .limit(500);

  if (error) {
    logger.warn("loadInterventionJournalSnapshot rule query failed", {
      locationId: input.locationId,
      error: error.message,
    });
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const payload = (row as { payload?: Record<string, unknown> }).payload;
    const ruleId =
      typeof payload?.ruleId === "string" && payload.ruleId.trim()
        ? payload.ruleId.trim()
        : "none";
    counts[ruleId] = (counts[ruleId] ?? 0) + 1;
  }

  return counts;
}

export async function loadInterventionJournalSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    periodDays?: number;
  }
): Promise<InterventionJournalSnapshot | null> {
  const periodDays = input.periodDays ?? 7;
  const toDate = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), periodDays - 1), "yyyy-MM-dd");
  const sinceIso = subDays(new Date(), periodDays).toISOString();

  const { data: locationRow } = await admin
    .from("locations")
    .select("id, name")
    .eq("id", input.locationId)
    .maybeSingle();

  if (!locationRow) return null;

  const config = await loadConciergeConfigForLocation(input.locationId);
  const mode = resolveInterventionMode(config);
  const configuredMode = resolveInterventionConfiguredMode(config);
  const manifestVersion = resolveInterventionManifestVersion(config);

  const { data: rollupRows, error: rollupError } = await admin
    .from("experience_analytics_daily" as never)
    .select("by_outcome")
    .eq("location_id", input.locationId)
    .gte("metric_date", fromDate)
    .lte("metric_date", toDate);

  if (rollupError) {
    logger.warn("loadInterventionJournalSnapshot rollup failed", {
      locationId: input.locationId,
      error: rollupError.message,
    });
  }

  const byOutcome: Record<string, number> = {};
  for (const row of rollupRows ?? []) {
    mergeCountMaps(
      byOutcome,
      (row as { by_outcome?: Record<string, number> }).by_outcome
    );
  }

  const byRuleId = await loadRuleFireCounts(admin, {
    locationId: input.locationId,
    sinceIso,
  });

  const insight = analyzeInterventionJournal({ byOutcome, byRuleId });

  return {
    locationId: input.locationId,
    locationName: (locationRow as { name: string }).name,
    periodDays,
    fromDate,
    toDate,
    mode,
    configuredMode,
    manifestVersion,
    journalActive: mode !== "off",
    ...insight,
  };
}
