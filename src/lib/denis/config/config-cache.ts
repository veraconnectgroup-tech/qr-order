import {
  CONCIERGE_CONFIG_CACHE_TTL_SECONDS,
  conciergeConfigCacheKey,
} from "@/lib/denis/config/concierge-defaults";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

export async function getCachedConciergeConfig(
  locationId: string
): Promise<ConciergeConfig | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<ConciergeConfig>(
      conciergeConfigCacheKey(locationId)
    );
    if (cached?.version === 1) {
      logger.info("Concierge config cache hit", { locationId });
      return cached;
    }
  } catch (error) {
    logRedisDegradation(`concierge-config:read:${locationId}`, error);
    logger.warn("Concierge config cache read failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

export async function setCachedConciergeConfig(
  locationId: string,
  config: ConciergeConfig
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(conciergeConfigCacheKey(locationId), config, {
      ex: CONCIERGE_CONFIG_CACHE_TTL_SECONDS,
    });
    logger.info("Concierge config cache set", { locationId });
  } catch (error) {
    logRedisDegradation(`concierge-config:write:${locationId}`, error);
    logger.warn("Concierge config cache write failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function invalidateConciergeConfigCache(
  locationId: string
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.del(conciergeConfigCacheKey(locationId));
    logger.info("Concierge config cache invalidated", { locationId });
  } catch (error) {
    logger.warn("Concierge config cache invalidation failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
