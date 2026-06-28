/** Kitchen Mind Link — per-prep-station routing and default timings. */

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

const GRILL_PATTERN =
  /\b(burger|hamburger|pljeskav|steak|ribeye|grill|roštilj|rostilj|piletina\s+na\s+grilu|beef|teletina|svinjetina|ćevap|cevap)\b/i;
const FRYER_PATTERN =
  /\b(pomfrit|fries|prženo|przeno|fried|wings|krilca|tempura|kroket|nuggets)\b/i;
const SALAD_PATTERN =
  /\b(salat|salad|salata|cezar|caesar|zelena|bowl)\b/i;
const COLD_PATTERN =
  /\b(tatar|carpaccio|bruschetta|suši|sushi|ceviche|hladn)\b/i;

export type StationAlternative = {
  triggerProductPattern: RegExp;
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
      triggerProductPattern: GRILL_PATTERN,
      alternativeName: "Pečeno pile",
      alternativeProductId: "roasted-chicken-id",
      prepMinutes: 8,
      station: "fryer",
      reasonKey: "grill_busy_roasted_chicken",
    },
    {
      triggerProductPattern: /steak|ribeye|teletina/i,
      alternativeName: "Tuna steak",
      prepMinutes: 10,
      station: "grill",
      reasonKey: "grill_busy_tuna",
    },
  ],
  fryer: [
    {
      triggerProductPattern: FRYER_PATTERN,
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
}): KitchenPrepStation {
  const tag = input.stationTag?.trim().toLowerCase();
  if (tag === "grill" || tag === "fryer" || tag === "salad" || tag === "cold") {
    return tag;
  }

  if (input.menuSection === "desserts") return "pass";

  const name = input.productName.trim();
  if (GRILL_PATTERN.test(name)) return "grill";
  if (FRYER_PATTERN.test(name)) return "fryer";
  if (SALAD_PATTERN.test(name)) return "salad";
  if (COLD_PATTERN.test(name)) return "cold";

  return "grill";
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
