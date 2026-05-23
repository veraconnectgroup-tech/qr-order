import { AI_CONFIG } from "@/lib/ai/config";
import { getAiRedis } from "@/lib/ai/redis";
import { logger } from "@/lib/logger";

function menuCacheKey(locationId: string) {
  return `${AI_CONFIG.menuCacheKeyPrefix}${locationId}`;
}

/** Client-safe — no service-role Supabase import. */
export async function invalidateMenuCache(locationId: string) {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.del(menuCacheKey(locationId));
    logger.info("AI menu cache invalidated", { locationId });
  } catch (error) {
    logger.warn("AI menu cache invalidation failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
