import {
  analyzeMenu,
  menuEngineeringCategoryMap,
  type MenuEngineeringCategory,
  type MenuEngineeringProduct,
} from "@/lib/denis/platform/menu-engineering";
import { loadMenuEngineeringOrderRows } from "@/lib/denis/platform/load-menu-engineering-rows";
import { getRedisClient } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_SECONDS = 6 * 60 * 60;
const LOOKBACK_DAYS = 30;

function cacheKey(locationId: string): string {
  return `denis:menu-engineering:${locationId}`;
}

async function loadMenuEngineeringProducts(
  admin: SupabaseClient,
  locationId: string
): Promise<MenuEngineeringProduct[]> {
  const { data, error } = await admin
    .from("products")
    .select("id, name, price, is_available")
    .eq("location_id", locationId)
    .eq("is_available", true);

  if (error) {
    logger.warn("loadMenuEngineeringProducts failed", {
      locationId,
      error: error.message,
    });
    return [];
  }

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    price: number | string | null;
    is_available: boolean;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price ?? 0),
    isAvailable: row.is_available,
  }));
}

/** Cached category map for proactive offer filtering (K2). */
export async function loadMenuEngineeringCategoryMap(
  admin: SupabaseClient,
  locationId: string
): Promise<Record<string, MenuEngineeringCategory>> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<Record<string, MenuEngineeringCategory>>(
        cacheKey(locationId)
      );
      if (cached && typeof cached === "object") {
        return cached;
      }
    } catch {
      // fall through to compute
    }
  }

  try {
    const [products, orderHistory] = await Promise.all([
      loadMenuEngineeringProducts(admin, locationId),
      loadMenuEngineeringOrderRows(admin, {
        locationId,
        lookbackDays: LOOKBACK_DAYS,
      }),
    ]);

    const insight = analyzeMenu({
      products,
      orderHistory,
      lookbackDays: LOOKBACK_DAYS,
    });

    const map = menuEngineeringCategoryMap(insight);

    if (redis && insight.hasEnoughData) {
      try {
        await redis.set(cacheKey(locationId), map, { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        logger.warn("menu engineering cache set failed", {
          locationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return map;
  } catch (error) {
    logger.warn("loadMenuEngineeringCategoryMap failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
