import { AI_CONFIG } from "@/lib/ai/config";
import { getAiRedis } from "@/lib/ai/redis";
import { logger } from "@/lib/logger";

function playbookCacheKey(locationId: string) {
  return `${AI_CONFIG.playbookCacheKeyPrefix}${locationId}`;
}

export async function invalidatePlaybookCache(locationId: string) {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.del(playbookCacheKey(locationId));
    logger.info("AI playbook cache invalidated", { locationId });
  } catch (error) {
    logger.warn("AI playbook cache invalidation failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
