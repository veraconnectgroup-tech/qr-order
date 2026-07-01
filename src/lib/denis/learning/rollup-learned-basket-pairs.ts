import { computeBasketPairs } from "@/lib/denis/config/basket-pair-analysis";
import type {
  HistoricalOrderRow,
  LearnedBasketPairsJson,
} from "@/lib/denis/config/basket-pair-types";
import { invalidateRhythmPriorsCache } from "@/lib/denis/config/load-rhythm-priors";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOOKBACK_DAYS = 90;
const MAX_ORDER_ROWS = 12_000;

export async function fetchHistoricalOrderRows(
  admin: SupabaseClient,
  locationId: string
): Promise<HistoricalOrderRow[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
      session_id,
      order_items (product_id, product_name)
    `
    )
    .eq("location_id", locationId)
    .eq("status", "delivered")
    .not("session_id", "is", null)
    .gte("created_at", since)
    .limit(MAX_ORDER_ROWS);

  if (error) {
    throw new Error(error.message);
  }

  const rows: HistoricalOrderRow[] = [];

  for (const order of (data ?? []) as Array<{
    session_id: string | null;
    order_items: Array<{ product_id: string | null; product_name: string }> | null;
  }>) {
    const tableSessionId = order.session_id?.trim();
    if (!tableSessionId) continue;

    for (const item of order.order_items ?? []) {
      const productId = item.product_id?.trim();
      const productName = item.product_name?.trim();
      if (!productId || !productName) continue;
      rows.push({ tableSessionId, productId, productName });
    }
  }

  return rows;
}

export async function rollupLearnedBasketPairsForLocation(
  admin: SupabaseClient,
  locationId: string,
  orgId: string
): Promise<{ pairCount: number; scannedRows: number }> {
  const historicalRows = await fetchHistoricalOrderRows(admin, locationId);
  const pairs = computeBasketPairs(historicalRows);

  const payload: LearnedBasketPairsJson = {
    version: 1,
    pairs: pairs.slice(0, 120),
    computedAt: new Date().toISOString(),
  };

  const { error } = await admin
    .from("location_rhythm_priors" as never)
    .upsert(
      {
        location_id: locationId,
        org_id: orgId,
        learned_basket_pairs: payload,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "location_id" }
    );

  if (error) {
    throw new Error(error.message);
  }

  await invalidateRhythmPriorsCache(locationId);

  return { pairCount: pairs.length, scannedRows: historicalRows.length };
}

export async function runLearnedBasketPairsRollupTick(
  admin: SupabaseClient,
  options?: { limit?: number }
): Promise<{ locations: number; pairCount: number }> {
  const limit = options?.limit ?? 50;

  const { data: locationRows, error } = await admin
    .from("locations")
    .select("id, org_id")
    .eq("ai_concierge_enabled", true)
    .limit(limit);

  if (error || !locationRows?.length) {
    return { locations: 0, pairCount: 0 };
  }

  let pairCount = 0;

  for (const location of locationRows as Array<{ id: string; org_id: string }>) {
    try {
      const result = await rollupLearnedBasketPairsForLocation(
        admin,
        location.id,
        location.org_id
      );
      pairCount += result.pairCount;
    } catch (rollupError) {
      logger.warn("learned basket pairs rollup failed", {
        locationId: location.id,
        error:
          rollupError instanceof Error
            ? rollupError.message
            : String(rollupError),
      });
    }
  }

  return { locations: locationRows.length, pairCount };
}
