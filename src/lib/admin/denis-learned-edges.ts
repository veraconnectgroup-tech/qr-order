import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  acceptRate,
  aggregateSessionPairStats,
  meetsLearnedEdgeThreshold,
  suggestedWeightFromAcceptRate,
} from "@/lib/denis/learning/compute-pair-stats";
import {
  aggregateNudgeEdgeStats,
  type NudgeSessionTimelineInput,
} from "@/lib/denis/learning/compute-nudge-edge-stats";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { invalidateVenueKnowledgeGraphCache } from "@/lib/denis/kernel/vkg";
import type { LearnedEdgeStatus } from "@/lib/denis/learning/types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LearnedEdgeRow = {
  id: string;
  edge_type: string;
  from_product_id: string;
  to_product_id: string;
  impressions: number;
  accepts: number;
  accept_rate: number;
  suggested_weight: number;
  status: LearnedEdgeStatus;
  created_at: string;
};

type SessionRow = {
  products_recommended: string[];
  products_added: string[];
};

export async function loadLearnedEdgeQueue(
  admin: SupabaseClient,
  locationId: string,
  status: LearnedEdgeStatus = "pending"
): Promise<LearnedEdgeRow[]> {
  const { data, error } = await admin
    .from("denis_learned_edges" as never)
    .select(
      "id, edge_type, from_product_id, to_product_id, impressions, accepts, accept_rate, suggested_weight, status, created_at"
    )
    .eq("location_id", locationId)
    .eq("status", status)
    .order("accept_rate", { ascending: false })
    .order("impressions", { ascending: false });

  if (error) {
    logger.warn("Learned edge queue load failed", {
      locationId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []) as LearnedEdgeRow[];
}

export async function aggregateLearnedEdgesForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<{ upserted: number; scanned: number }> {
  const config = await loadConciergeConfigForLocation(locationId);
  if (!config.enabled || !config.learning.learnedEdgesEnabled) {
    return { upserted: 0, scanned: 0 };
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: sessionRows, error } = await admin
    .from("ai_sessions")
    .select("products_recommended, products_added")
    .eq("location_id", locationId)
    .gte("created_at", since)
    .not("products_recommended", "eq", "{}");

  if (error) {
    logger.warn("Learned edge aggregate: sessions failed", {
      locationId,
      error: error.message,
    });
    return { upserted: 0, scanned: 0 };
  }

  const sessions = ((sessionRows ?? []) as SessionRow[]).map((row) => ({
    productsRecommended: row.products_recommended ?? [],
    productsAdded: row.products_added ?? [],
  }));

  const stats = aggregateSessionPairStats(sessions);
  let upserted = 0;

  for (const stat of stats) {
    const rate = acceptRate(stat.impressions, stat.accepts);
    if (
      !meetsLearnedEdgeThreshold({
        impressions: stat.impressions,
        acceptRate: rate,
        minImpressions: config.learning.minImpressionsForSuggestion,
        minAcceptRate: config.learning.minAcceptRateForSuggestion,
      })
    ) {
      continue;
    }

    const { data: existing } = await admin
      .from("denis_learned_edges" as never)
      .select("id, status")
      .eq("location_id", locationId)
      .eq("edge_type", "pairs_with")
      .eq("from_product_id", stat.fromProductId)
      .eq("to_product_id", stat.toProductId)
      .maybeSingle();

    const row = existing as { id: string; status: LearnedEdgeStatus } | null;
    if (row?.status === "approved" || row?.status === "rejected") {
      continue;
    }

    const payload = {
      location_id: locationId,
      edge_type: "pairs_with",
      from_product_id: stat.fromProductId,
      to_product_id: stat.toProductId,
      impressions: stat.impressions,
      accepts: stat.accepts,
      accept_rate: rate,
      suggested_weight: suggestedWeightFromAcceptRate(rate),
      status: "pending" as const,
      source: "aggregate",
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = row?.id
      ? await admin
          .from("denis_learned_edges" as never)
          .update(payload as never)
          .eq("id", row.id)
      : await admin.from("denis_learned_edges" as never).insert(payload as never);

    if (!upsertError) upserted++;
  }

  return { upserted, scanned: sessions.length };
}

async function loadNudgeSessionTimelines(
  admin: SupabaseClient,
  locationId: string,
  since: string,
  limit = 120
): Promise<NudgeSessionTimelineInput[]> {
  const { data: sessionRows, error } = await admin
    .from("ai_sessions")
    .select("id, products_added")
    .eq("location_id", locationId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !sessionRows?.length) return [];

  const sessions: NudgeSessionTimelineInput[] = [];

  for (const row of sessionRows as Array<{
    id: string;
    products_added: string[] | null;
  }>) {
    const timeline = await loadDenisTimeline(admin, row.id);
    if (timeline.length === 0) continue;

    sessions.push({
      anchorProductId: row.products_added?.[0] ?? null,
      timeline,
    });
  }

  return sessions;
}

export async function aggregateNudgeLearnedEdgesForLocation(
  admin: SupabaseClient,
  locationId: string
): Promise<{ upserted: number; scanned: number }> {
  const config = await loadConciergeConfigForLocation(locationId);
  if (!config.enabled || !config.learning.learnedEdgesEnabled) {
    return { upserted: 0, scanned: 0 };
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sessions = await loadNudgeSessionTimelines(admin, locationId, since);
  const stats = aggregateNudgeEdgeStats(sessions);
  let upserted = 0;

  for (const stat of stats) {
    const rate = acceptRate(stat.impressions, stat.accepts);
    if (
      !meetsLearnedEdgeThreshold({
        impressions: stat.impressions,
        acceptRate: rate,
        minImpressions: config.learning.minImpressionsForSuggestion,
        minAcceptRate: config.learning.minAcceptRateForSuggestion,
      })
    ) {
      continue;
    }

    const { data: existing } = await admin
      .from("denis_learned_edges" as never)
      .select("id, status")
      .eq("location_id", locationId)
      .eq("edge_type", "upsell_after")
      .eq("from_product_id", stat.fromProductId)
      .eq("to_product_id", stat.toProductId)
      .maybeSingle();

    const row = existing as { id: string; status: LearnedEdgeStatus } | null;
    if (row?.status === "approved" || row?.status === "rejected") {
      continue;
    }

    const payload = {
      location_id: locationId,
      edge_type: "upsell_after",
      from_product_id: stat.fromProductId,
      to_product_id: stat.toProductId,
      impressions: stat.impressions,
      accepts: stat.accepts,
      accept_rate: rate,
      suggested_weight: suggestedWeightFromAcceptRate(rate),
      status: "pending" as const,
      source: "aggregate",
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = row?.id
      ? await admin
          .from("denis_learned_edges" as never)
          .update(payload as never)
          .eq("id", row.id)
      : await admin.from("denis_learned_edges" as never).insert(payload as never);

    if (!upsertError) upserted++;
  }

  return { upserted, scanned: sessions.length };
}

export async function promoteLearnedEdgeToUpsellRule(
  admin: SupabaseClient,
  input: {
    locationId: string;
    edgeId: string;
    staffId: string;
  }
): Promise<{ error?: string; upsellRuleId?: string }> {
  const { data: edgeRow, error: loadError } = await admin
    .from("denis_learned_edges" as never)
    .select("id, location_id, from_product_id, to_product_id, suggested_weight, status")
    .eq("id", input.edgeId)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (loadError || !edgeRow) {
    return { error: "Learned edge not found." };
  }

  const edge = edgeRow as {
    id: string;
    location_id: string;
    from_product_id: string;
    to_product_id: string;
    suggested_weight: number;
    status: LearnedEdgeStatus;
  };

  if (edge.status !== "pending") {
    return { error: "Edge already reviewed." };
  }

  const { data: productRow } = await admin
    .from("products")
    .select("name")
    .eq("id", edge.to_product_id)
    .maybeSingle();

  const suggestName = (productRow as { name: string } | null)?.name ?? "preporuku";

  const { data: maxRow } = await admin
    .from("upsell_rules")
    .select("sort_order")
    .eq("location_id", input.locationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort =
    ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const message = `Denis predlaže: ${suggestName}`;

  const { data: ruleRow, error: insertError } = await admin
    .from("upsell_rules")
    .insert({
      location_id: input.locationId,
      trigger_product_id: edge.from_product_id,
      trigger_category_id: null,
      suggest_product_id: edge.to_product_id,
      message,
      sort_order: nextSort,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !ruleRow) {
    return { error: insertError?.message ?? "Could not create upsell rule." };
  }

  const upsellRuleId = (ruleRow as { id: string }).id;

  const { error: updateError } = await admin
    .from("denis_learned_edges" as never)
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by_staff_id: input.staffId,
      upsell_rule_id: upsellRuleId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", edge.id);

  if (updateError) {
    return { error: updateError.message };
  }

  await invalidateVenueKnowledgeGraphCache(input.locationId);
  return { upsellRuleId };
}

export async function rejectLearnedEdge(
  admin: SupabaseClient,
  input: {
    locationId: string;
    edgeId: string;
    staffId: string;
  }
): Promise<{ error?: string }> {
  const { error } = await admin
    .from("denis_learned_edges" as never)
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by_staff_id: input.staffId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.edgeId)
    .eq("location_id", input.locationId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  return {};
}

export async function runDenisLearnedEdgesAggregateTick(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<{ locations: number; upserted: number }> {
  const limit = options?.limit ?? 50;

  const { data: locationRows } = await admin
    .from("locations")
    .select("id")
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  const locations = (locationRows ?? []) as Array<{ id: string }>;
  let upserted = 0;

  for (const location of locations) {
    const pairResult = await aggregateLearnedEdgesForLocation(admin, location.id);
    const nudgeResult = await aggregateNudgeLearnedEdgesForLocation(
      admin,
      location.id
    );
    upserted += pairResult.upserted + nudgeResult.upserted;
  }

  return { locations: locations.length, upserted };
}
