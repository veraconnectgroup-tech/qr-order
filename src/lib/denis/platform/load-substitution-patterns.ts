import {
  learnSubstitutionPatterns,
  type SubstitutionPattern,
} from "@/lib/denis/platform/substitution-intelligence";
import { loadSubstitutionModifierRows } from "@/lib/denis/platform/load-substitution-modifier-rows";
import { getRedisClient } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_SECONDS = 6 * 60 * 60;
const LOOKBACK_DAYS = 90;

function cacheKey(locationId: string): string {
  return `denis:substitution-patterns:${locationId}`;
}

/** Cached venue substitution patterns for proactive waiter gaps (K3). */
export async function loadSubstitutionPatterns(
  admin: SupabaseClient,
  locationId: string
): Promise<SubstitutionPattern[]> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<SubstitutionPattern[]>(cacheKey(locationId));
      if (Array.isArray(cached)) {
        return cached;
      }
    } catch {
      // fall through
    }
  }

  try {
    const rows = await loadSubstitutionModifierRows(admin, {
      locationId,
      lookbackDays: LOOKBACK_DAYS,
    });
    const patterns = learnSubstitutionPatterns(rows);

    if (redis && patterns.length > 0) {
      try {
        await redis.set(cacheKey(locationId), patterns, {
          ex: CACHE_TTL_SECONDS,
        });
      } catch (error) {
        logger.warn("substitution pattern cache set failed", {
          locationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return patterns;
  } catch (error) {
    logger.warn("loadSubstitutionPatterns failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
