import { AI_CONFIG } from "@/lib/ai/config";
import { getAiRedis } from "@/lib/ai/redis";
import type { AiMenuCachePayload, AiProductSummary } from "@/lib/ai/types";
import { formatPrice } from "@/lib/format";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

type RawCategory = {
  id: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  products: RawProduct[] | null;
};

type RawProduct = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  ai_description: string | null;
  allergens: string[] | null;
  sort_order: number;
  deleted_at?: string | null;
};

function menuCacheKey(locationId: string) {
  return `${AI_CONFIG.menuCacheKeyPrefix}${locationId}`;
}

function pickProductName(product: RawProduct, useEnglish: boolean) {
  if (useEnglish && product.name_en?.trim()) return product.name_en.trim();
  return product.name;
}

function pickDescription(product: RawProduct, useEnglish: boolean) {
  const ai = product.ai_description?.trim();
  if (ai) return ai;
  if (useEnglish && product.description_en?.trim()) {
    return product.description_en.trim();
  }
  return product.description?.trim() ?? "";
}

function buildMenuPayload(
  categories: RawCategory[],
  currency: string,
  useEnglish: boolean
): AiMenuCachePayload {
  const productMap: Record<string, AiProductSummary> = {};
  const lines: string[] = [];

  const sortedCategories = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  for (const category of sortedCategories) {
    const categoryName = useEnglish && category.name_en?.trim()
      ? category.name_en.trim()
      : category.name;

    const products = (category.products ?? [])
      .filter((p) => p.is_available && !p.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (!products.length) continue;

    lines.push(`## ${categoryName}`);

    for (const product of products) {
      const name = pickProductName(product, useEnglish);
      const description = pickDescription(product, useEnglish);
      const priceLabel = formatPrice(Number(product.price), currency);
      const allergenPart =
        product.allergens?.length ? ` | allergens: ${product.allergens.join(", ")}` : "";

      lines.push(
        `[${product.id}] ${name} — ${priceLabel}${description ? ` — ${description}` : ""}${allergenPart}`
      );

      productMap[product.id] = {
        id: product.id,
        name,
        price: Number(product.price),
        imageUrl: product.image_url,
      };
    }

    lines.push("");
  }

  return {
    menuText: lines.join("\n").trim(),
    productMap,
    currency,
    cachedAt: new Date().toISOString(),
  };
}

async function loadMenuFromDb(
  locationId: string,
  useEnglish = false
): Promise<AiMenuCachePayload> {
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
        deleted_at
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

  const availableProducts = ((categories ?? []) as unknown as RawCategory[]).map(
    (category) => ({
      ...category,
      products: (category.products ?? []).filter(
        (p) => p.is_available !== false && !p.deleted_at
      ),
    })
  );

  return buildMenuPayload(availableProducts, currency, useEnglish);
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
      const cached = await redis.get<AiMenuCachePayload>(cacheKey);
      if (cached?.menuText && cached.productMap) {
        logger.info("AI menu cache hit", { locationId });
        return cached;
      }
    } catch (error) {
      logger.warn("AI menu cache read failed, falling back to DB", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const payload = await loadMenuFromDb(locationId, useEnglish);

  if (redis) {
    try {
      await redis.set(cacheKey, payload, {
        ex: AI_CONFIG.menuCacheTtlSeconds,
      });
      logger.info("AI menu cache set", {
        locationId,
        productCount: Object.keys(payload.productMap).length,
      });
    } catch (error) {
      logger.warn("AI menu cache write failed", {
        locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return payload;
}

export { invalidateMenuCache } from "@/lib/ai/menu-cache-invalidate";
