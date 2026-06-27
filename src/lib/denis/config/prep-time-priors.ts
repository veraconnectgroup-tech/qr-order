import type { PrepTimeFact } from "@/lib/commerce/projections/collect-prep-time-facts";

export type PrepStation = "kitchen" | "bar" | "dessert";

export type PrepTimePrior = {
  productId: string;
  p50Minutes: number;
  p90Minutes: number;
  sampleCount: number;
  rushMultiplier: number;
};

export type PrepStationPrior = {
  p50: number;
  p90: number;
  samples: number;
  rushMultiplier: number;
};

export type LocationPrepTimePriorsJson = {
  version: 1;
  byProduct: Record<string, PrepTimePrior>;
  byStation: Partial<Record<PrepStation, PrepStationPrior>>;
  updatedAt: string;
};

export type LocationPrepTimePriors = {
  byProduct: Map<string, PrepTimePrior>;
  byStation: Map<PrepStation, PrepStationPrior>;
  updatedAt: string;
};

export type PrepTimeEstimate = {
  etaMinutes: number | null;
  confidence: "high" | "low" | "none";
};

export type PrepTimeEstimateItem = {
  productId: string;
  station: PrepStation;
};

const STATIONS: PrepStation[] = ["kitchen", "bar", "dessert"];

const DEFAULT_RUSH_MULTIPLIER = 1.4;
const HIGH_CONFIDENCE_SAMPLES = 5;

export function emptyLocationPrepTimePriorsJson(): LocationPrepTimePriorsJson {
  return {
    version: 1,
    byProduct: {},
    byStation: {},
    updatedAt: new Date(0).toISOString(),
  };
}

export function parseLocationPrepTimePriors(
  value: unknown
): LocationPrepTimePriorsJson | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (typeof record.byProduct !== "object" || !record.byProduct) return null;
  if (typeof record.updatedAt !== "string") return null;

  return value as LocationPrepTimePriorsJson;
}

export function locationPrepTimePriorsFromJson(
  json: LocationPrepTimePriorsJson
): LocationPrepTimePriors {
  const byProduct = new Map<string, PrepTimePrior>();
  for (const [key, prior] of Object.entries(json.byProduct)) {
    if (!prior || typeof prior !== "object") continue;
    byProduct.set(key, prior);
  }

  const byStation = new Map<PrepStation, PrepStationPrior>();
  for (const station of STATIONS) {
    const prior = json.byStation[station];
    if (prior) byStation.set(station, prior);
  }

  return {
    byProduct,
    byStation,
    updatedAt: json.updatedAt,
  };
}

export function locationPrepTimePriorsToJson(
  priors: LocationPrepTimePriors
): LocationPrepTimePriorsJson {
  return {
    version: 1,
    byProduct: Object.fromEntries(priors.byProduct.entries()),
    byStation: Object.fromEntries(priors.byStation.entries()),
    updatedAt: priors.updatedAt,
  };
}

function estimateForItem(
  priors: LocationPrepTimePriors,
  item: PrepTimeEstimateItem,
  isRush: boolean
): PrepTimeEstimate {
  const productPrior = priors.byProduct.get(item.productId);
  if (productPrior && productPrior.sampleCount >= HIGH_CONFIDENCE_SAMPLES) {
    const multiplier = isRush ? productPrior.rushMultiplier : 1;
    return {
      etaMinutes: Math.max(1, Math.round(productPrior.p50Minutes * multiplier)),
      confidence: "high",
    };
  }

  const stationPrior = priors.byStation.get(item.station);
  if (stationPrior && stationPrior.samples > 0) {
    const multiplier = isRush ? stationPrior.rushMultiplier : 1;
    return {
      etaMinutes: Math.max(1, Math.round(stationPrior.p50 * multiplier)),
      confidence: "low",
    };
  }

  return { etaMinutes: null, confidence: "none" };
}

/** Honest ETA from learned priors — pure math, no LLM (A2). */
export function resolvePrepTimeEstimate(
  priors: LocationPrepTimePriors | null | undefined,
  items: PrepTimeEstimateItem[],
  isRush: boolean
): PrepTimeEstimate {
  if (!priors || items.length === 0) {
    return { etaMinutes: null, confidence: "none" };
  }

  const estimates = items.map((item) => estimateForItem(priors, item, isRush));
  const withMinutes = estimates.filter(
    (estimate) => estimate.etaMinutes != null
  );

  if (!withMinutes.length) {
    return { etaMinutes: null, confidence: "none" };
  }

  const etaMinutes = Math.max(
    ...withMinutes.map((estimate) => estimate.etaMinutes ?? 0)
  );
  const confidence = withMinutes.some(
    (estimate) => estimate.confidence === "high"
  )
    ? "high"
    : "low";

  return { etaMinutes, confidence };
}

export function formatPrepTimeConfidence(
  confidence: PrepTimeEstimate["confidence"]
): string {
  switch (confidence) {
    case "high":
      return "high confidence";
    case "low":
      return "station avg";
    default:
      return "unknown";
  }
}
