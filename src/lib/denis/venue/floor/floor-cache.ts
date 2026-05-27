import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import { getAiRedis } from "@/lib/ai/redis";
import { logRedisDegradation } from "@/lib/redis/client";

export const FLOOR_CACHE_KEY_PREFIX = "denis:floor:";
export const FLOOR_CACHE_TTL_SECONDS = 30;

export function floorCacheKey(locationId: string): string {
  return `${FLOOR_CACHE_KEY_PREFIX}${locationId}`;
}

export async function readFloorGraphCache(
  locationId: string
): Promise<FloorGraph | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<FloorGraph>(floorCacheKey(locationId));
    if (cached?.locationId === locationId && cached.at) {
      return cached;
    }
  } catch (error) {
    logRedisDegradation(`floor:read:${locationId}`, error);
  }

  return null;
}

export async function writeFloorGraphCache(
  locationId: string,
  floor: FloorGraph
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(floorCacheKey(locationId), floor, {
      ex: FLOOR_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logRedisDegradation(`floor:write:${locationId}`, error);
  }
}
