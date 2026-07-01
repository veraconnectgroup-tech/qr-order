import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import type {
  LocationPrepTimePriorsJson,
  PrepStation,
} from "@/lib/denis/config/prep-time-priors";

export const MIN_CROSS_VENUE_LOCATIONS = 3;
export const CROSS_VENUE_BLEND_SESSIONS = 50;
export const CROSS_VENUE_LOCAL_ONLY_SESSIONS = 200;
/** Max cross-venue share while location is immature (< 50 sessions). */
export const CROSS_VENUE_MAX_BLEND_WEIGHT = 0.8;

export type VenueType = "casual" | "fine_dining" | "cafe" | "bar";

export type CrossVenuePriorMetric =
  | "avg_prep_minutes"
  | "dessert_nudge_minutes"
  | "popular_substitution"
  | "basket_pair";

/** Privacy-safe aggregate — never guest ids or order lines (L1). */
export type CrossVenuePrior = {
  metric: CrossVenuePriorMetric;
  /** Category label — station, product family, region code, or venue type. */
  productCategory: string;
  value: number | string;
  sampleLocations: number;
  sampleSessions: number;
  confidence: number;
};

export type CrossVenueLocationPriors = {
  locationId: string;
  priors: LocationRhythmPriorsJson;
  completedSessions?: number;
  venueType?: VenueType;
  countryCode?: string;
};

const STATIONS: PrepStation[] = ["kitchen", "bar", "dessert"];

/** Industry defaults when org has no sibling history yet (L1 — category only). */
export const GLOBAL_INDUSTRY_PRIORS: CrossVenuePrior[] = [
  {
    metric: "avg_prep_minutes",
    productCategory: "kitchen",
    value: 18,
    sampleLocations: 0,
    sampleSessions: 0,
    confidence: 0.35,
  },
  {
    metric: "avg_prep_minutes",
    productCategory: "bar",
    value: 5,
    sampleLocations: 0,
    sampleSessions: 0,
    confidence: 0.35,
  },
  {
    metric: "dessert_nudge_minutes",
    productCategory: "default",
    value: 15,
    sampleLocations: 0,
    sampleSessions: 0,
    confidence: 0.4,
  },
  {
    metric: "basket_pair",
    productCategory: "burger",
    value: "Burger + Beer",
    sampleLocations: 0,
    sampleSessions: 0,
    confidence: 0.5,
  },
  {
    metric: "basket_pair",
    productCategory: "pasta",
    value: "Pasta + Wine",
    sampleLocations: 0,
    sampleSessions: 0,
    confidence: 0.5,
  },
  {
    metric: "popular_substitution",
    productCategory: "DE",
    value: "glutenfrei",
    sampleLocations: 0,
    sampleSessions: 0,
    confidence: 0.7,
  },
];

const VENUE_TYPE_PREP_MINUTES: Record<VenueType, Partial<Record<PrepStation, number>>> = {
  casual: { kitchen: 16, bar: 4, dessert: 8 },
  fine_dining: { kitchen: 22, bar: 6, dessert: 10 },
  cafe: { kitchen: 10, bar: 3, dessert: 6 },
  bar: { kitchen: 14, bar: 3, dessert: 0 },
};

function normalizeCategory(name: string): string {
  const token = name.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return token.replace(/[^a-z0-9]/g, "") || "item";
}

function crossVenueConfidence(input: {
  sampleLocations: number;
  sampleSessions: number;
}): number {
  const locationFactor = Math.min(1, input.sampleLocations / MIN_CROSS_VENUE_LOCATIONS);
  const sessionFactor = Math.min(1, input.sampleSessions / CROSS_VENUE_BLEND_SESSIONS);
  return Math.round(locationFactor * sessionFactor * 100) / 100;
}

export function filterLocationsByVenueType(
  rows: CrossVenueLocationPriors[],
  venueType?: VenueType | null
): CrossVenueLocationPriors[] {
  if (!venueType) return rows;
  const typed = rows.filter((row) => row.venueType === venueType);
  return typed.length >= MIN_CROSS_VENUE_LOCATIONS ? typed : rows;
}

/** Cross-venue weight — 80% cross below 50 sessions, linear fade 50→200, local-only after. */
export function crossVenueBlendWeight(completedSessions: number): number {
  if (completedSessions >= CROSS_VENUE_LOCAL_ONLY_SESSIONS) return 0;
  if (completedSessions < CROSS_VENUE_BLEND_SESSIONS) {
    return CROSS_VENUE_MAX_BLEND_WEIGHT;
  }
  return (
    CROSS_VENUE_MAX_BLEND_WEIGHT *
    ((CROSS_VENUE_LOCAL_ONLY_SESSIONS - completedSessions) /
      (CROSS_VENUE_LOCAL_ONLY_SESSIONS - CROSS_VENUE_BLEND_SESSIONS))
  );
}

export function localBlendWeight(completedSessions: number): number {
  return Math.round((1 - crossVenueBlendWeight(completedSessions)) * 100) / 100;
}

function aggregatePrepPriors(
  locationPriors: CrossVenueLocationPriors[],
  priors: CrossVenuePrior[]
): void {
  for (const station of STATIONS) {
    let weightedSum = 0;
    let weightTotal = 0;
    let sampleLocations = 0;
    let sampleSessions = 0;

    for (const row of locationPriors) {
      const stationPrior = row.priors.prepTime?.byStation?.[station];
      if (!stationPrior || stationPrior.samples <= 0) continue;

      weightedSum += stationPrior.p50 * stationPrior.samples;
      weightTotal += stationPrior.samples;
      sampleLocations += 1;
      sampleSessions += stationPrior.samples;
    }

    if (sampleLocations < MIN_CROSS_VENUE_LOCATIONS || weightTotal <= 0) continue;

    priors.push({
      metric: "avg_prep_minutes",
      productCategory: station,
      value: Math.round(weightedSum / weightTotal),
      sampleLocations,
      sampleSessions,
      confidence: crossVenueConfidence({ sampleLocations, sampleSessions }),
    });
  }
}

function aggregateDessertDelay(
  locationPriors: CrossVenueLocationPriors[],
  priors: CrossVenuePrior[]
): void {
  let weightedSum = 0;
  let weightTotal = 0;
  let sampleLocations = 0;

  for (const row of locationPriors) {
    for (const slot of Object.values(row.priors.slots)) {
      if (slot.dessertDelayP50Min == null || slot.sampleSessions <= 0) continue;
      weightedSum += slot.dessertDelayP50Min * slot.sampleSessions;
      weightTotal += slot.sampleSessions;
      sampleLocations += 1;
      break;
    }
  }

  if (sampleLocations < MIN_CROSS_VENUE_LOCATIONS || weightTotal <= 0) return;

  priors.push({
    metric: "dessert_nudge_minutes",
    productCategory: "default",
    value: Math.round(weightedSum / weightTotal),
    sampleLocations,
    sampleSessions: weightTotal,
    confidence: crossVenueConfidence({
      sampleLocations,
      sampleSessions: weightTotal,
    }),
  });
}

function aggregateBasketPairs(
  locationPriors: CrossVenueLocationPriors[],
  priors: CrossVenuePrior[]
): void {
  const basketCounts = new Map<
    string,
    { category: string; pair: string; locations: Set<string>; sessions: number }
  >();

  for (const row of locationPriors) {
    for (const slot of Object.values(row.priors.slots)) {
      const products = slot.topProducts ?? [];
      if (products.length < 2) continue;

      const anchor = products[0]!;
      const companion = products[1]!;
      const category = normalizeCategory(anchor.name);
      const pair = `${anchor.name} + ${companion.name}`;
      const key = `${category}:${pair.toLowerCase()}`;
      const existing = basketCounts.get(key);
      if (existing) {
        existing.locations.add(row.locationId);
        existing.sessions += slot.sampleSessions;
      } else {
        basketCounts.set(key, {
          category,
          pair,
          locations: new Set([row.locationId]),
          sessions: slot.sampleSessions,
        });
      }
    }
  }

  for (const entry of basketCounts.values()) {
    if (entry.locations.size < MIN_CROSS_VENUE_LOCATIONS) continue;
    priors.push({
      metric: "basket_pair",
      productCategory: entry.category,
      value: entry.pair,
      sampleLocations: entry.locations.size,
      sampleSessions: entry.sessions,
      confidence: crossVenueConfidence({
        sampleLocations: entry.locations.size,
        sampleSessions: entry.sessions,
      }),
    });
  }
}

function aggregateRegionalSubstitutions(
  locationPriors: CrossVenueLocationPriors[],
  priors: CrossVenuePrior[]
): void {
  const regionCounts = new Map<string, { locations: Set<string>; sessions: number }>();

  for (const row of locationPriors) {
    const code = row.countryCode?.trim().toUpperCase();
    if (!code) continue;
    const existing = regionCounts.get(code);
    if (existing) {
      existing.locations.add(row.locationId);
      existing.sessions += row.completedSessions ?? 0;
    } else {
      regionCounts.set(code, {
        locations: new Set([row.locationId]),
        sessions: row.completedSessions ?? 0,
      });
    }
  }

  for (const [region, stats] of regionCounts) {
    if (stats.locations.size < MIN_CROSS_VENUE_LOCATIONS) continue;
    const global = GLOBAL_INDUSTRY_PRIORS.find(
      (row) =>
        row.metric === "popular_substitution" && row.productCategory === region
    );
    if (!global) continue;
    priors.push({
      ...global,
      sampleLocations: stats.locations.size,
      sampleSessions: stats.sessions,
      confidence: crossVenueConfidence({
        sampleLocations: stats.locations.size,
        sampleSessions: stats.sessions,
      }),
    });
  }
}

/** Aggregate org-wide priors from sibling locations (L1 — privacy-safe, category only). */
export function computeCrossVenuePriors(
  organizationId: string,
  locationPriors: CrossVenueLocationPriors[],
  options?: { targetVenueType?: VenueType | null }
): CrossVenuePrior[] {
  if (!organizationId.trim()) return [];

  const filtered = filterLocationsByVenueType(
    locationPriors,
    options?.targetVenueType
  );

  if (filtered.length < MIN_CROSS_VENUE_LOCATIONS) {
    return mergeWithGlobalPriors([], options?.targetVenueType);
  }

  const priors: CrossVenuePrior[] = [];
  aggregatePrepPriors(filtered, priors);
  aggregateDessertDelay(filtered, priors);
  aggregateBasketPairs(filtered, priors);
  aggregateRegionalSubstitutions(filtered, priors);

  return mergeWithGlobalPriors(
    priors.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.sampleLocations - a.sampleLocations
    ),
    options?.targetVenueType
  );
}

/** Fill gaps with industry / venue-type defaults — never individual guest data. */
export function mergeWithGlobalPriors(
  orgPriors: CrossVenuePrior[],
  venueType?: VenueType | null
): CrossVenuePrior[] {
  const merged = [...orgPriors];
  const existing = new Set(
    orgPriors.map((row) => `${row.metric}:${row.productCategory}`)
  );

  for (const prior of GLOBAL_INDUSTRY_PRIORS) {
    const key = `${prior.metric}:${prior.productCategory}`;
    if (existing.has(key)) continue;
    merged.push({ ...prior });
  }

  if (venueType) {
    for (const [station, minutes] of Object.entries(
      VENUE_TYPE_PREP_MINUTES[venueType]
    )) {
      const key = `avg_prep_minutes:${station}`;
      if (existing.has(key) || minutes == null) continue;
      merged.push({
        metric: "avg_prep_minutes",
        productCategory: station,
        value: minutes,
        sampleLocations: 0,
        sampleSessions: 0,
        confidence: 0.3,
      });
    }
  }

  return merged.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.sampleLocations - a.sampleLocations
  );
}

function crossVenueStationMinutes(
  crossPriors: CrossVenuePrior[],
  station: PrepStation
): number | null {
  const prior = crossPriors.find(
    (row) =>
      row.metric === "avg_prep_minutes" && row.productCategory === station
  );
  return typeof prior?.value === "number" ? prior.value : null;
}

export function resolveCrossVenueDessertDelay(
  crossPriors: CrossVenuePrior[],
  configDefaultMinutes: number
): number {
  const prior = crossPriors.find(
    (row) =>
      row.metric === "dessert_nudge_minutes" &&
      row.productCategory === "default"
  );
  return typeof prior?.value === "number" ? prior.value : configDefaultMinutes;
}

function blendMinutes(
  local: number | null | undefined,
  cross: number | null,
  weight: number
): number | null {
  if (weight <= 0) return local ?? null;
  if (cross == null) return local ?? null;
  if (local == null || weight >= 1) return cross;
  return Math.round(local * (1 - weight) + cross * weight);
}

/** Merge local prep priors with org cross-venue fallback (L1). */
export function applyCrossVenuePrepFallback(input: {
  localPriors: LocationRhythmPriorsJson | null | undefined;
  crossPriors: CrossVenuePrior[];
  completedSessions: number;
  configDefaultMinutes?: number;
}): LocationRhythmPriorsJson {
  const base = input.localPriors ?? { version: 1 as const, slots: {} };
  const weight = crossVenueBlendWeight(input.completedSessions);
  const prepTime: LocationPrepTimePriorsJson = base.prepTime
    ? { ...base.prepTime, byStation: { ...base.prepTime.byStation } }
    : {
        version: 1,
        byProduct: {},
        byStation: {},
        updatedAt: new Date().toISOString(),
      };

  for (const station of STATIONS) {
    const crossMinutes = crossVenueStationMinutes(input.crossPriors, station);
    if (crossMinutes == null && weight <= 0) continue;

    const localStation = prepTime.byStation[station];
    const blendedP50 = blendMinutes(localStation?.p50, crossMinutes, weight);
    if (blendedP50 == null) continue;

    const localSamples = localStation?.samples ?? 0;
    const blendedP90 = blendMinutes(
      localStation?.p90,
      Math.round(blendedP50 * (localStation?.rushMultiplier ?? 1.4)),
      weight
    );

    prepTime.byStation[station] = {
      p50: blendedP50,
      p90: blendedP90 ?? Math.round(blendedP50 * 1.4),
      samples: Math.max(
        localSamples,
        crossMinutes != null && weight > 0 ? 1 : 0
      ),
      rushMultiplier: localStation?.rushMultiplier ?? 1.4,
    };
  }

  return applyCrossVenueDessertFallback({
    localPriors: { ...base, prepTime },
    crossPriors: input.crossPriors,
    completedSessions: input.completedSessions,
    configDefaultMinutes: input.configDefaultMinutes ?? 20,
  });
}

/** Blend dessert upsell timing when local rhythm slots are sparse (L1). */
export function applyCrossVenueDessertFallback(input: {
  localPriors: LocationRhythmPriorsJson;
  crossPriors: CrossVenuePrior[];
  completedSessions: number;
  configDefaultMinutes: number;
}): LocationRhythmPriorsJson {
  const weight = crossVenueBlendWeight(input.completedSessions);
  const crossDelay = resolveCrossVenueDessertDelay(
    input.crossPriors,
    input.configDefaultMinutes
  );

  const slots = { ...input.localPriors.slots };
  const slotKeys = Object.keys(slots);

  if (slotKeys.length === 0 && weight > 0) {
    slots["cross-venue-default"] = {
      sampleSessions: 0,
      sessionDurationP50Min: null,
      dessertDelayP50Min: crossDelay,
      revenueEma: null,
      topProducts: [],
      servicePeriod: "dinner",
    };
    return { ...input.localPriors, slots };
  }

  for (const key of slotKeys) {
    const slot = slots[key]!;
    const localDelay = slot.dessertDelayP50Min;
    const blended = blendMinutes(localDelay, crossDelay, weight);
    if (blended == null) continue;
    slots[key] = {
      ...slot,
      dessertDelayP50Min: blended,
    };
  }

  return { ...input.localPriors, slots };
}

export function crossVenueUsesFallback(completedSessions: number): boolean {
  return crossVenueBlendWeight(completedSessions) > 0;
}

export function findCrossVenueBasketPairs(
  crossPriors: CrossVenuePrior[],
  productCategory?: string
): CrossVenuePrior[] {
  return crossPriors.filter(
    (row) =>
      row.metric === "basket_pair" &&
      (!productCategory || row.productCategory === productCategory)
  );
}

export function findCrossVenueSubstitutionAwareness(
  crossPriors: CrossVenuePrior[],
  countryCode?: string | null
): string[] {
  const region = countryCode?.trim().toUpperCase();
  if (!region) return [];
  return crossPriors
    .filter(
      (row) =>
        row.metric === "popular_substitution" &&
        row.productCategory === region &&
        typeof row.value === "string"
    )
    .map((row) => String(row.value));
}
