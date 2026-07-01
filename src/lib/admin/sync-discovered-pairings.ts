import type { SupabaseClient } from "@supabase/supabase-js";
import { promoteLearnedEdgeToUpsellRule } from "@/lib/admin/denis-learned-edges";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import {
  discoverPairings,
  type LearnedPairing,
} from "@/lib/denis/intelligence/dynamic-vkg";
import { invalidateVenueKnowledgeGraphCache } from "@/lib/denis/kernel/vkg";
import { logger } from "@/lib/logger";

const LOOKBACK_DAYS = 30;
const MAX_ORDERS = 8000;

export type SyncDiscoveredPairingsResult = {
  scannedOrders: number;
  discovered: number;
  pending: number;
  autoApproved: number;
};

async function fetchOrdersForPairDiscovery(
  admin: SupabaseClient,
  locationId: string
): Promise<
  Array<{
    id: string;
    createdAt: string;
    items: Array<{ productId: string; createdAt?: string }>;
  }>
> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
      id,
      created_at,
      order_items (product_id, created_at)
    `
    )
    .eq("location_id", locationId)
    .eq("status", "delivered")
    .gte("created_at", since)
    .limit(MAX_ORDERS);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const order = row as {
      id: string;
      created_at: string;
      order_items: Array<{ product_id: string | null; created_at: string }> | null;
    };
    return {
      id: order.id,
      createdAt: order.created_at,
      items: (order.order_items ?? [])
        .filter((item) => item.product_id)
        .map((item) => ({
          productId: item.product_id!,
          createdAt: item.created_at,
        })),
    };
  });
}

async function upsertDiscoveredPairing(
  admin: SupabaseClient,
  locationId: string,
  pairing: LearnedPairing
): Promise<{ edgeId: string; created: boolean; autoAdd: boolean } | null> {
  const { data: existing } = await admin
    .from("denis_learned_edges" as never)
    .select("id, status")
    .eq("location_id", locationId)
    .eq("edge_type", "pairs_with")
    .eq("from_product_id", pairing.productA)
    .eq("to_product_id", pairing.productB)
    .maybeSingle();

  const row = existing as { id: string; status: string } | null;
  if (row?.status === "rejected") return null;

  const payload = {
    location_id: locationId,
    edge_type: "pairs_with",
    from_product_id: pairing.productA,
    to_product_id: pairing.productB,
    impressions: pairing.coOrderCount,
    accepts: pairing.coOrderCount,
    accept_rate: pairing.confidence,
    suggested_weight: Math.min(1, pairing.lift / 5),
    status: "pending" as const,
    source: "aggregate" as const,
    updated_at: new Date().toISOString(),
  };

  if (row?.id) {
    if (row.status === "approved") {
      return { edgeId: row.id, created: false, autoAdd: pairing.autoAdd };
    }
    const { error } = await admin
      .from("denis_learned_edges" as never)
      .update(payload as never)
      .eq("id", row.id);
    if (error) return null;
    return { edgeId: row.id, created: false, autoAdd: pairing.autoAdd };
  }

  const { data: inserted, error } = await admin
    .from("denis_learned_edges" as never)
    .insert(payload as never)
    .select("id")
    .single();

  if (error || !inserted) return null;
  return {
    edgeId: (inserted as { id: string }).id,
    created: true,
    autoAdd: pairing.autoAdd,
  };
}

/** X1 — weekly basket discovery → learned edge queue (+ auto upsell when lift ≥ 2). */
export async function syncDiscoveredPairingsForLocation(
  admin: SupabaseClient,
  input: {
    locationId: string;
    staffId?: string | null;
  }
): Promise<SyncDiscoveredPairingsResult> {
  const config = await loadConciergeConfigForLocation(input.locationId);
  if (!config.enabled || !config.learning.learnedEdgesEnabled) {
    return { scannedOrders: 0, discovered: 0, pending: 0, autoApproved: 0 };
  }

  const orders = await fetchOrdersForPairDiscovery(admin, input.locationId);
  const pairings = discoverPairings({
    orders,
    minCoOccurrence: 5,
    lookbackDays: LOOKBACK_DAYS,
  });

  let pending = 0;
  let autoApproved = 0;

  for (const pairing of pairings) {
    const upserted = await upsertDiscoveredPairing(
      admin,
      input.locationId,
      pairing
    );
    if (!upserted) continue;

    if (pairing.autoAdd && input.staffId) {
      const promoted = await promoteLearnedEdgeToUpsellRule(admin, {
        locationId: input.locationId,
        edgeId: upserted.edgeId,
        staffId: input.staffId,
      });
      if (!promoted.error) {
        autoApproved += 1;
        continue;
      }
    }

    if (pairing.autoAdd) {
      autoApproved += 1;
    } else if (pairing.needsApproval) {
      pending += 1;
    }
  }

  if (pairings.length > 0) {
    await invalidateVenueKnowledgeGraphCache(input.locationId);
  }

  logger.info("Discovered pairings synced", {
    locationId: input.locationId,
    scannedOrders: orders.length,
    discovered: pairings.length,
    pending,
    autoApproved,
  });

  return {
    scannedOrders: orders.length,
    discovered: pairings.length,
    pending,
    autoApproved,
  };
}

/** X1 — daily market basket sync for all Denis-enabled locations. */
export async function runDailyDynamicVkgSync(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<{
  locations: number;
  discovered: number;
  pending: number;
  autoApproved: number;
}> {
  const limit = options?.limit ?? 50;

  const { data: locationRows } = await admin
    .from("locations")
    .select("id")
    .eq("ai_concierge_enabled", true)
    .eq("is_active", true)
    .limit(limit);

  let discovered = 0;
  let pending = 0;
  let autoApproved = 0;

  for (const row of locationRows ?? []) {
    const locationId = (row as { id: string }).id;
    try {
      const result = await syncDiscoveredPairingsForLocation(admin, {
        locationId,
      });
      discovered += result.discovered;
      pending += result.pending;
      autoApproved += result.autoApproved;
    } catch (error) {
      logger.warn("Daily dynamic VKG sync failed", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    locations: locationRows?.length ?? 0,
    discovered,
    pending,
    autoApproved,
  };
}

export function formatLearnedEdgeLift(edge: {
  suggested_weight: number;
  accept_rate: number;
  impressions: number;
}): string {
  const lift = edge.suggested_weight * 5;
  const confidence = Math.round(Number(edge.accept_rate) * 100);
  return `${confidence}% · lift ${lift.toFixed(1)} · n=${edge.impressions}`;
}
