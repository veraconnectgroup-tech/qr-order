import {
  emptyLocationRhythmPriors,
  parseLocationRhythmPriors,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import { getAiRedis } from "@/lib/ai/redis";
import { CONCIERGE_CONFIG_CACHE_TTL_SECONDS } from "@/lib/denis/config/concierge-defaults";
import { logRedisDegradation } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationRhythmPriorsRow = {
  locationId: string;
  orgId: string;
  priors: LocationRhythmPriorsJson;
  timezone: string;
};

const RHYTHM_PRIORS_CACHE_KEY_PREFIX = "ai:rhythm-priors:";

export function rhythmPriorsCacheKey(locationId: string): string {
  return `${RHYTHM_PRIORS_CACHE_KEY_PREFIX}${locationId}`;
}

type CachedRhythmPriors = {
  orgId: string;
  priors: LocationRhythmPriorsJson;
  timezone: string;
};

export async function getCachedRhythmPriors(
  locationId: string
): Promise<CachedRhythmPriors | null> {
  const redis = getAiRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get<CachedRhythmPriors>(
      rhythmPriorsCacheKey(locationId)
    );
    if (cached?.priors?.version === 1) {
      return cached;
    }
  } catch (error) {
    logRedisDegradation(`rhythm-priors:read:${locationId}`, error);
  }

  return null;
}

async function setCachedRhythmPriors(
  locationId: string,
  value: CachedRhythmPriors
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.set(rhythmPriorsCacheKey(locationId), value, {
      ex: CONCIERGE_CONFIG_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logRedisDegradation(`rhythm-priors:write:${locationId}`, error);
  }
}

export async function invalidateRhythmPriorsCache(
  locationId: string
): Promise<void> {
  const redis = getAiRedis();
  if (!redis) return;

  try {
    await redis.del(rhythmPriorsCacheKey(locationId));
  } catch (error) {
    logger.warn("Rhythm priors cache invalidation failed", {
      locationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function loadLocationRhythmPriors(
  admin: SupabaseClient,
  locationId: string
): Promise<LocationRhythmPriorsRow | null> {
  const cached = await getCachedRhythmPriors(locationId);
  if (cached) {
    return {
      locationId,
      orgId: cached.orgId,
      priors: cached.priors,
      timezone: cached.timezone,
    };
  }

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("org_id, timezone")
    .eq("id", locationId)
    .maybeSingle();

  if (locationError || !location) {
    return null;
  }

  const locationRow = location as { org_id: string; timezone: string | null };

  const { data: row, error } = await admin
    .from("location_rhythm_priors" as never)
    .select("priors")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error) {
    logger.warn("location_rhythm_priors load failed", {
      locationId,
      error: error.message,
    });
    return null;
  }

  const priors =
    parseLocationRhythmPriors((row as { priors?: unknown } | null)?.priors) ??
    emptyLocationRhythmPriors();

  const timezone = locationRow.timezone?.trim() || "Europe/Berlin";

  await setCachedRhythmPriors(locationId, {
    orgId: locationRow.org_id,
    priors,
    timezone,
  });

  return {
    locationId,
    orgId: locationRow.org_id,
    priors,
    timezone,
  };
}
