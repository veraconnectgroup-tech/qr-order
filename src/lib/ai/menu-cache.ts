import { AI_CONFIG } from "@/lib/ai/config";
import { buildAiCatalog } from "@/lib/ai/catalog/catalog-builder";
import type { AiCatalog } from "@/lib/ai/catalog/catalog-types";
import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import type { AiMenuCachePayload, AiProductSummary } from "@/lib/ai/types";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

function menuCacheKey(locationId: string) {
  return `${AI_CONFIG.menuCacheKeyPrefix}${locationId}`;
}

async function loadMenuFromDb(
  locationId: string,
  useEnglish = false
): Promise<AiCatalog> {
  const admin = createAdminClient();

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("id, organization:organizations(currency)")
    .eq("id", locationId)
    .single();

  if (locationError || !location) {
    throw new Error("Location not found.");
  }

  const org = (location as unknown as {
    organization: { currency: string } | null;
  }).organization;
  const currency = org?.currency ?? "EUR";

  const { data: categories, error } = await admin
    .from("categories")
    .select(
      `
      id,
      name,
      name_en,
      menu_section,
      sort_order,
      products (
        id,
        name,
        name_en,
        description,
        description_en,
        price,
        image_url,
        is_available,
        ai_description,
        allergens,
        sort_order,
        requires_serve_size,
        serve_size_presets,
        allow_custom_serve_size,
        tax_rate,
        deleted_at,
        modifier_groups (
          id,
          name,
          name_en,
          min_select,
          max_select,
          is_required,
          sort_order,
          modifiers (
            id,
            name,
            name_en,
            price,
            is_available,
            sort_order
          )
        )
      )
    `
    )
    .eq("location_id", locationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");

  if (error) {
    throw new Error(`Menu load failed: ${error.message}`);
  }

  return buildAiCatalog(
    (categories ?? []) as unknown as Parameters<typeof buildAiCatalog>[0],
    currency,
    useEnglish
  );
}

export async function getCachedMenuForLocation(
  locationId: string,
  options?: { useEnglish?: boolean; bypassCache?: boolean }
): Promise<AiMenuCachePayload> {
  const useEnglish = options?.useEnglish ?? false;
  const cacheKey = menuCacheKey(locationId);
  const redis = getAiRedis();

  if (redis && !options?.bypassCache) {
    try {
      const cached = await redis.get<AiCatalog>(cacheKey);
      if (cached?.menuText && cached.catalog) {
        logger.info("AI menu cache hit", { locationId });
        return toMenuPayload(cached);
      }
    } catch (error) {
      logRedisDegradation(`menu-cache:read:${locationId}`, error);
      logger.warn("AI menu cache read failed, falling back to DB", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const catalog = await loadMenuFromDb(locationId, useEnglish);

  if (redis) {
    try {
      await redis.set(cacheKey, catalog, {
        ex: AI_CONFIG.menuCacheTtlSeconds,
      });
      logger.info("AI menu cache set", {
        locationId,
        productCount: Object.keys(catalog.catalog).length,
      });
    } catch (error) {
      logRedisDegradation(`menu-cache:write:${locationId}`, error);
      logger.warn("AI menu cache write failed", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return toMenuPayload(catalog);
}

function toMenuPayload(catalog: AiCatalog): AiMenuCachePayload {
  return {
    menuText: catalog.menuText,
    productMap: catalog.productMap,
    catalog: catalog.catalog,
    currency: catalog.currency,
    cachedAt: catalog.cachedAt,
  };
}

export { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";

/** @deprecated use AiMenuCachePayload.catalog */
export type { AiProductSummary };
