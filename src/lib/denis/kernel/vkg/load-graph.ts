import { buildVenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/build-graph";
import type { VenueKnowledgeGraph } from "@/lib/denis/kernel/vkg/types";
import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const VKG_CACHE_KEY_PREFIX = "ai:vkg:";
export const VKG_CACHE_TTL_SECONDS = 300;

export function vkgCacheKey(locationId: string): string {
  return `${VKG_CACHE_KEY_PREFIX}${locationId}`;
}

export async function loadVenueKnowledgeGraph(
  locationId: string,
  options?: { bypassCache?: boolean }
): Promise<VenueKnowledgeGraph> {
  const redis = getAiRedis();
  if (redis && !options?.bypassCache) {
    try {
      const cached = await redis.get<VenueKnowledgeGraph>(
        vkgCacheKey(locationId)
      );
      if (cached?.locationId === locationId && cached.products) {
        logger.info("VKG cache hit", { locationId });
        return cached;
      }
    } catch (error) {
      logRedisDegradation(`vkg:read:${locationId}`, error);
    }
  }

  const admin = createAdminClient();

  const { data: products, error: productsError } = await admin
    .from("products")
    .select(
      "id, name, category_id, price, is_available, allergens, ai_description"
    )
    .eq("location_id", locationId)
    .is("deleted_at", null);

  if (productsError) {
    logger.warn("VKG product load failed", {
      locationId,
      error: productsError.message,
    });
  }

  const { data: categories, error: categoriesError } = await admin
    .from("categories")
    .select("id, name, menu_section")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (categoriesError) {
    logger.warn("VKG category load failed", {
      locationId,
      error: categoriesError.message,
    });
  }

  const categorySectionMap = new Map(
    (
      (categories as Array<{ id: string; menu_section: string }>) ?? []
    ).map((row) => [row.id, row.menu_section])
  );

  const { data: rules, error: rulesError } = await admin
    .from("upsell_rules")
    .select(
      "id, trigger_product_id, trigger_category_id, suggest_product_id, message, sort_order"
    )
    .eq("location_id", locationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (rulesError) {
    logger.warn("VKG upsell rules load failed", {
      locationId,
      error: rulesError.message,
    });
  }

  type ProductRow = {
    id: string;
    name: string;
    category_id: string | null;
    price: number;
    is_available: boolean;
    allergens: string[] | null;
    ai_description: string | null;
  };

  const graph = buildVenueKnowledgeGraph({
    locationId,
    products: ((products as ProductRow[]) ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category_id: row.category_id,
      price: Number(row.price),
      is_available: row.is_available,
      allergens: row.allergens,
      ai_description: row.ai_description,
      menu_section: row.category_id
        ? (categorySectionMap.get(row.category_id) ?? "food")
        : "food",
    })),
    categories: (
      (categories as Array<{
        id: string;
        name: string;
        menu_section: string;
      }>) ?? []
    ).map((row) => ({
      id: row.id,
      name: row.name,
      menu_section: row.menu_section,
    })),
    upsellRules: (
      (rules as Array<{
        id: string;
        trigger_product_id: string | null;
        trigger_category_id: string | null;
        suggest_product_id: string;
        message: string | null;
        sort_order: number;
      }>) ?? []
    ),
  });

  if (redis) {
    try {
      await redis.set(vkgCacheKey(locationId), graph, {
        ex: VKG_CACHE_TTL_SECONDS,
      });
      logger.info("VKG cache set", {
        locationId,
        productCount: Object.keys(graph.products).length,
        edgeCount: graph.edges.length,
      });
    } catch (error) {
      logRedisDegradation(`vkg:write:${locationId}`, error);
    }
  }

  return graph;
}

export async function invalidateVenueKnowledgeGraphCache(
  locationId: string
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;
  try {
    await redis.del(vkgCacheKey(locationId));
    logger.info("VKG cache invalidated", { locationId });
  } catch (error) {
    logger.warn("VKG cache invalidation failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
