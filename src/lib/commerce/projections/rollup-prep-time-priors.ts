import {
  emptyLocationPrepTimePriorsJson,
  type PrepStation,
} from "@/lib/denis/config/prep-time-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";

export type PrepTimeFact = {
  locationId: string;
  productId: string;
  productName: string;
  menuSection: string | null;
  station: PrepStation;
  prepMinutes: number;
  dayOfWeek: number;
  hour: number;
  isRush: boolean;
};

const EWMA_ALPHA = 0.15;

function ewma(previous: number, sample: number): number {
  return Math.round(previous + EWMA_ALPHA * (sample - previous));
}

export function applyPrepTimeFactsToPriors(
  priors: LocationRhythmPriorsJson,
  facts: PrepTimeFact[]
): LocationRhythmPriorsJson {
  const next = structuredClone(priors);
  const prepTime =
    next.prepTime != null
      ? {
          ...next.prepTime,
          byProduct: { ...next.prepTime.byProduct },
          byStation: { ...next.prepTime.byStation },
        }
      : emptyLocationPrepTimePriorsJson();

  for (const fact of facts) {
    const existingProduct = prepTime.byProduct[fact.productId];
    const product = existingProduct ?? {
      productId: fact.productId,
      p50Minutes: fact.prepMinutes,
      p90Minutes: fact.prepMinutes + 4,
      sampleCount: 0,
      rushMultiplier: 1.4,
    };

    product.sampleCount += 1;
    product.p50Minutes =
      product.sampleCount === 1
        ? fact.prepMinutes
        : ewma(product.p50Minutes, fact.prepMinutes);
    product.p90Minutes = Math.max(product.p90Minutes, product.p50Minutes + 4);
    prepTime.byProduct[fact.productId] = product;

    const existingStation = prepTime.byStation[fact.station];
    const station = existingStation ?? {
      p50: fact.prepMinutes,
      p90: fact.prepMinutes + 3,
      samples: 0,
      rushMultiplier: 1.4,
    };

    station.samples += 1;
    station.p50 =
      station.samples === 1
        ? fact.prepMinutes
        : ewma(station.p50, fact.prepMinutes);
    station.p90 = Math.max(station.p90, station.p50 + 3);
    prepTime.byStation[fact.station] = station;
  }

  prepTime.updatedAt = new Date().toISOString();

  return {
    ...next,
    prepTime,
  };
}
