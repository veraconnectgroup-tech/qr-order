/** Kitchen Mind Link — per-prep-station routing and default timings. */

import { resolvePrepStationFromProduct } from "@/lib/denis/catalog/product-semantics";

export type KitchenPrepStation = "grill" | "fryer" | "salad" | "cold" | "pass";

export const KITCHEN_PREP_STATIONS: KitchenPrepStation[] = [
  "grill",
  "fryer",
  "salad",
  "cold",
  "pass",
];

/** Queue depth strictly greater than threshold → rush mode for that station. */
export const STATION_RUSH_QUEUE_THRESHOLD = 4;

export const DEFAULT_PREP_MINUTES: Record<KitchenPrepStation, number> = {
  grill: 12,
  fryer: 8,
  salad: 4,
  cold: 5,
  pass: 2,
};

export type StationAlternative = {
  triggerFoodTag: string;
  alternativeName: string;
  alternativeProductId?: string;
  prepMinutes: number;
  station: KitchenPrepStation;
  reasonKey: string;
};

/** Positive redirect when a prep station is overloaded. */
export const STATION_ALTERNATIVES: Partial<
  Record<KitchenPrepStation, StationAlternative[]>
> = {
  grill: [
    {
      triggerFoodTag: "burger",
      alternativeName: "Pečeno pile",
      alternativeProductId: "roasted-chicken-id",
      prepMinutes: 8,
      station: "fryer",
      reasonKey: "grill_busy_roasted_chicken",
    },
    {
      triggerFoodTag: "grilled",
      alternativeName: "Pečeno pile",
      alternativeProductId: "roasted-chicken-id",
      prepMinutes: 8,
      station: "fryer",
      reasonKey: "grill_busy_roasted_chicken",
    },
    {
      triggerFoodTag: "steak",
      alternativeName: "Tuna steak",
      prepMinutes: 10,
      station: "grill",
      reasonKey: "grill_busy_tuna",
    },
  ],
  fryer: [
    {
      triggerFoodTag: "fried",
      alternativeName: "Salata sa piletinom",
      prepMinutes: 6,
      station: "salad",
      reasonKey: "fryer_busy_salad",
    },
  ],
};

export function resolveKitchenPrepStation(input: {
  productName: string;
  productId?: string | null;
  menuSection?: string | null;
  stationTag?: string | null;
  prepStation?: string | null;
  foodTags?: string[];
  drinkFamily?: string | null;
}): KitchenPrepStation {
  return resolvePrepStationFromProduct({
    menuSection: input.menuSection ?? null,
    foodTags: input.foodTags ?? [],
    drinkFamily: input.drinkFamily ?? null,
    prepStation: input.prepStation ?? input.stationTag ?? null,
  });
}

export function defaultPrepMinutesForStation(
  station: KitchenPrepStation
): number {
  return DEFAULT_PREP_MINUTES[station];
}

export function isStationInRush(queueDepth: number): boolean {
  return queueDepth > STATION_RUSH_QUEUE_THRESHOLD;
}

export function formatStationQueueLabel(
  loads: Array<{ station: KitchenPrepStation; queueDepth: number }>
): string {
  return loads
    .map((row) => `${capitalize(row.station)}(${row.queueDepth})`)
    .join(", ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
