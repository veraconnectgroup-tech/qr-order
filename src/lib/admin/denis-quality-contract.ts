import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import { parseVenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import {
  aggregateLlmInvocationRate,
  runQualityContractEval,
  type QualityContractEvalResult,
} from "@/lib/denis/cognition/quality";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DenisQualityContractStripData = QualityContractEvalResult & {
  liveLlmInvocationRate: number | null;
  liveTurnCount: number;
};

function extractManifestRaw(config: unknown): unknown {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }
  const row = config as Record<string, unknown>;
  return row.venue_manifest ?? row.venueManifest ?? row.manifest ?? null;
}

async function loadRecentTimelineLlmRate(
  admin: SupabaseClient,
  locationId: string
): Promise<{ rate: number | null; turnCount: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions } = await admin
    .from("ai_sessions")
    .select("id")
    .eq("location_id", locationId)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(12);

  const sessionIds = (sessions ?? []).map((row) => row.id as string);
  if (!sessionIds.length) {
    return { rate: null, turnCount: 0 };
  }

  let turnCount = 0;
  let llmTurnCount = 0;

  for (const sessionId of sessionIds) {
    const events = await loadDenisTimeline(admin, sessionId);
    const recent = events.slice(-200);
    const aggregate = aggregateLlmInvocationRate(recent);
    turnCount += aggregate.turnCount;
    llmTurnCount += aggregate.llmTurnCount;
  }

  return {
    rate: turnCount ? llmTurnCount / turnCount : null,
    turnCount,
  };
}

/** MR-7 admin strip — eval contract + optional live timeline LLM rate (24h). */
export async function loadDenisQualityContractStrip(
  locationId: string
): Promise<DenisQualityContractStripData> {
  const admin = createAdminClient();
  const [{ data: locationRow }, live, config] = await Promise.all([
    admin
      .from("locations")
      .select("ai_concierge_config")
      .eq("id", locationId)
      .maybeSingle(),
    loadRecentTimelineLlmRate(admin, locationId),
    loadConciergeConfigForLocation(locationId),
  ]);

  const manifestRaw = extractManifestRaw(locationRow?.ai_concierge_config);
  const effective = mergeManifestConfig(config, manifestRaw);
  const evalResult = runQualityContractEval(
    effective.qualityContract ??
      parseVenueManifest(manifestRaw)?.qualityContract ??
      null,
    { liveLlmInvocationRate: live.rate }
  );

  return {
    ...evalResult,
    liveLlmInvocationRate: live.rate,
    liveTurnCount: live.turnCount,
  };
}
