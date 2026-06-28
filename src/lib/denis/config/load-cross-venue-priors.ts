import { countLocationCompletedSessions } from "@/lib/denis/config/count-location-completed-sessions";
import {
  applyCrossVenuePrepFallback,
  computeCrossVenuePriors,
  crossVenueUsesFallback,
  mergeWithGlobalPriors,
  MIN_CROSS_VENUE_LOCATIONS,
  type CrossVenuePrior,
  type VenueType,
} from "@/lib/denis/config/cross-venue-priors";
import { loadLocationRhythmPriors } from "@/lib/denis/config/load-rhythm-priors";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { getRedisClient } from "@/lib/redis/client";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_SECONDS = 6 * 60 * 60;
const MAX_ORG_LOCATIONS = 40;

function cacheKey(orgId: string): string {
  return `denis:cross-venue-priors:${orgId}`;
}

async function loadOrganizationLocationIds(
  admin: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("locations")
    .select("id")
    .eq("org_id", orgId)
    .eq("ai_concierge_enabled", true)
    .limit(MAX_ORG_LOCATIONS);

  if (error) {
    logger.warn("loadOrganizationLocationIds failed", {
      orgId,
      error: error.message,
    });
    return [];
  }

  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

/** Cached org-wide priors for sibling-location fallback (L1). */
export async function loadCrossVenuePriors(
  admin: SupabaseClient,
  input: {
    orgId: string;
    excludeLocationId?: string;
    venueType?: VenueType | null;
  }
): Promise<CrossVenuePrior[]> {
  const orgId = input.orgId.trim();
  if (!orgId) return [];

  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<CrossVenuePrior[]>(cacheKey(orgId));
      if (Array.isArray(cached)) {
        return cached;
      }
    } catch {
      // fall through
    }
  }

  try {
    const locationIds = await loadOrganizationLocationIds(admin, orgId);
    const siblingIds = locationIds.filter((id) => id !== input.excludeLocationId);

    if (siblingIds.length < MIN_CROSS_VENUE_LOCATIONS) {
      return mergeWithGlobalPriors([], input.venueType ?? null);
    }

    const rows = await Promise.all(
      siblingIds.map(async (locationId) => {
        const row = await loadLocationRhythmPriors(admin, locationId);
        if (!row) return null;
        const completedSessions = await countLocationCompletedSessions(
          admin,
          locationId
        );
        return {
          locationId,
          priors: row.priors,
          completedSessions,
        };
      })
    );

    const locationPriors = rows.filter(
      (row): row is NonNullable<typeof row> => row != null
    );

    const priors = computeCrossVenuePriors(orgId, locationPriors, {
      targetVenueType: input.venueType,
    });

    if (redis && priors.length > 0) {
      try {
        await redis.set(cacheKey(orgId), priors, { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        logger.warn("cross-venue priors cache set failed", {
          orgId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return priors;
  } catch (error) {
    logger.warn("loadCrossVenuePriors failed", {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** Apply org fallback to an already-loaded local rhythm row (L1). */
export async function applyCrossVenueToRhythmRow(
  admin: SupabaseClient,
  row: Awaited<ReturnType<typeof loadLocationRhythmPriors>>
) {
  if (!row) {
    return {
      row: null as Awaited<ReturnType<typeof loadLocationRhythmPriors>>,
      crossPriors: [] as CrossVenuePrior[],
      completedSessions: 0,
    };
  }

  const config = await loadConciergeConfigForLocation(row.locationId);
  const venueType = config.learning.crossVenue?.enabled
    ? config.learning.crossVenue.venueType
    : null;

  const [crossPriors, completedSessions] = await Promise.all([
    loadCrossVenuePriors(admin, {
      orgId: row.orgId,
      excludeLocationId: row.locationId,
      venueType,
    }),
    countLocationCompletedSessions(admin, row.locationId),
  ]);

  if (!crossPriors.length && !crossVenueUsesFallback(completedSessions)) {
    return { row, crossPriors, completedSessions };
  }

  const effectiveCrossPriors =
    crossPriors.length > 0
      ? crossPriors
      : mergeWithGlobalPriors([], venueType);

  return {
    row: {
      ...row,
      priors: applyCrossVenuePrepFallback({
        localPriors: row.priors,
        crossPriors: effectiveCrossPriors,
        completedSessions,
        configDefaultMinutes: config.upsell.dessertDelayMinutes,
      }),
    },
    crossPriors: effectiveCrossPriors,
    completedSessions,
  };
}
