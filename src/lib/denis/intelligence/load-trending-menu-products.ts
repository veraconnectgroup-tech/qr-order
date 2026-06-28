import { startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { MIN_TRENDING_ORDERS_TODAY } from "@/lib/denis/intelligence/menu-personalization";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TrendingMenuProducts = {
  productIds: string[];
  orderCountsToday: Record<string, number>;
};

/** Venue-wide trending products for menu personalization (Q3). */
export async function loadTrendingMenuProducts(
  admin: SupabaseClient,
  input: {
    locationId: string;
    timezone?: string | null;
    limit?: number;
  }
): Promise<TrendingMenuProducts> {
  const timezone = input.timezone?.trim() || "Europe/Berlin";
  const limit = input.limit ?? 12;
  const zonedNow = toZonedTime(new Date(), timezone);
  const sinceIso = startOfDay(zonedNow).toISOString();

  const { data: orderRows, error: orderError } = await admin
    .from("orders")
    .select("id")
    .eq("location_id", input.locationId)
    .gte("created_at", sinceIso)
    .not("status", "in", '("rejected","cancelled")');

  if (orderError) {
    logger.warn("loadTrendingMenuProducts orders failed", {
      locationId: input.locationId,
      error: orderError.message,
    });
    return { productIds: [], orderCountsToday: {} };
  }

  const orderIds = (orderRows ?? []).map((row) => (row as { id: string }).id);
  if (orderIds.length === 0) {
    return { productIds: [], orderCountsToday: {} };
  }

  const { data: itemRows, error: itemError } = await admin
    .from("order_items")
    .select("product_id, quantity")
    .in("order_id", orderIds);

  if (itemError) {
    logger.warn("loadTrendingMenuProducts items failed", {
      locationId: input.locationId,
      error: itemError.message,
    });
    return { productIds: [], orderCountsToday: {} };
  }

  const counts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    const productId = (row as { product_id: string | null }).product_id;
    if (!productId) continue;
    const quantity = Number((row as { quantity: number }).quantity ?? 1);
    counts.set(productId, (counts.get(productId) ?? 0) + Math.max(1, quantity));
  }

  const ranked = [...counts.entries()]
    .filter(([, count]) => count >= MIN_TRENDING_ORDERS_TODAY)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const orderCountsToday: Record<string, number> = {};
  for (const [productId, count] of ranked) {
    orderCountsToday[productId] = count;
  }

  return {
    productIds: ranked.map(([productId]) => productId),
    orderCountsToday,
  };
}

export type TrendingKnowledgeHint = {
  productId: string;
  productName: string;
  orderCountToday: number;
};

/** Map today's trending products into venue knowledge taste hints. */
export function trendingProductsToKnowledgeHints(input: {
  trending: TrendingMenuProducts;
  productNames: Record<string, string>;
}): TrendingKnowledgeHint[] {
  return input.trending.productIds.map((productId) => ({
    productId,
    productName: input.productNames[productId]?.trim() || productId,
    orderCountToday: input.trending.orderCountsToday[productId] ?? 0,
  }));
}
