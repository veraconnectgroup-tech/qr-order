import {
  locationPrepTimePriorsFromJson,
  menuSectionToStation,
  parseLocationPrepTimePriors,
  resolvePrepTimeEstimate,
  type LocationPrepTimePriors,
  type PrepTimeEstimateItem,
} from "@/lib/denis/config/prep-time-priors";
import {
  defaultPrepMinutesForStation,
  isStationInRush,
  resolveKitchenPrepStation,
  STATION_ALTERNATIVES,
  STATION_RUSH_QUEUE_THRESHOLD,
  type KitchenPrepStation,
  type StationAlternative,
} from "@/lib/denis/venue/ops/kitchen-prep-stations";

export type KitchenLoadOrderItem = {
  product_id?: string | null;
  product_name: string;
  menu_section?: string | null;
  quantity?: number;
  station_tag?: string | null;
  food_tags?: string[];
  prep_station?: string | null;
  drink_family?: string | null;
};

export type KitchenLoadOrder = {
  status: string;
  order_items?: KitchenLoadOrderItem[] | null;
};

export type KitchenStationLoad = {
  station: KitchenPrepStation;
  queueDepth: number;
  rushMode: boolean;
  avgWaitMinutes: number | null;
};

export type KitchenLoadSnapshot = {
  stations: KitchenStationLoad[];
  rushStations: KitchenPrepStation[];
  overloadedStation: KitchenPrepStation | null;
  venueRushMode: boolean;
};

export type PerItemPrepEstimate = {
  productId: string;
  productName: string;
  station: KitchenPrepStation;
  etaMinutes: number;
};

export type ParallelPrepEstimate = {
  /** Parallel prep — max across stations, not sum. */
  totalMinutes: number;
  perItem: PerItemPrepEstimate[];
  arrivesFirst: PerItemPrepEstimate | null;
  arrivesLast: PerItemPrepEstimate | null;
};

export type BottleneckSuggestion = {
  insteadOf: string;
  alternativeName: string;
  alternativeProductId?: string;
  prepMinutes: number;
  overloadedStation: KitchenPrepStation;
  queueDepth: number;
  reasonKey: string;
};

const ACTIVE_KITCHEN_STATUSES = ["pending", "accepted", "preparing"] as const;

function isActiveKitchenStatus(status: string): boolean {
  return (ACTIVE_KITCHEN_STATUSES as readonly string[]).includes(status);
}

function isKitchenItem(item: KitchenLoadOrderItem): boolean {
  const section = item.menu_section;
  return section === "food" || section === "desserts" || section == null;
}

/** Per-station queue depth from active kitchen orders. */
export function buildKitchenLoadSnapshot(
  orders: KitchenLoadOrder[]
): KitchenLoadSnapshot {
  const counts = new Map<KitchenPrepStation, number>();

  for (const order of orders) {
    if (!isActiveKitchenStatus(order.status)) continue;
    for (const item of order.order_items ?? []) {
      if (!isKitchenItem(item)) continue;
      const qty = Math.max(1, item.quantity ?? 1);
      const station = resolveKitchenPrepStation({
        productName: item.product_name,
        productId: item.product_id,
        menuSection: item.menu_section,
        stationTag: item.station_tag,
        foodTags: item.food_tags,
        prepStation: item.prep_station,
        drinkFamily: item.drink_family,
      });
      counts.set(station, (counts.get(station) ?? 0) + qty);
    }
  }

  const stations: KitchenStationLoad[] = (
    ["grill", "fryer", "salad", "cold", "pass"] as KitchenPrepStation[]
  ).map((station) => {
    const queueDepth = counts.get(station) ?? 0;
    return {
      station,
      queueDepth,
      rushMode: isStationInRush(queueDepth),
      avgWaitMinutes: queueDepth > 0 ? queueDepth * 3 : null,
    };
  });

  const rushStations = stations
    .filter((row) => row.rushMode)
    .map((row) => row.station);

  const overloaded = [...stations].sort(
    (a, b) => b.queueDepth - a.queueDepth
  )[0];

  return {
    stations,
    rushStations,
    overloadedStation:
      overloaded && overloaded.queueDepth > STATION_RUSH_QUEUE_THRESHOLD
        ? overloaded.station
        : null,
    venueRushMode: rushStations.length > 0,
  };
}

function resolveItemEtaMinutes(input: {
  productId: string;
  productName: string;
  menuSection?: string | null;
  stationTag?: string | null;
  priors: LocationPrepTimePriors | null | undefined;
  isRush: boolean;
}): PerItemPrepEstimate {
  const station = resolveKitchenPrepStation({
    productName: input.productName,
    productId: input.productId,
    menuSection: input.menuSection,
    stationTag: input.stationTag,
  });

  const estimateItem: PrepTimeEstimateItem = {
    productId: input.productId,
    station: menuSectionToStation(input.menuSection ?? "food"),
  };

  const fromPriors = input.priors
    ? resolvePrepTimeEstimate(input.priors, [estimateItem], input.isRush)
    : { etaMinutes: null, confidence: "none" as const };

  const etaMinutes =
    fromPriors.etaMinutes ?? defaultPrepMinutesForStation(station);

  return {
    productId: input.productId,
    productName: input.productName,
    station,
    etaMinutes,
  };
}

/** Combined prep estimate — parallel stations use max(), not sum(). */
export function estimateParallelPrepMinutes(input: {
  items: Array<{
    productId: string;
    productName: string;
    menuSection?: string | null;
    stationTag?: string | null;
  }>;
  priors?: LocationPrepTimePriors | null;
  load?: KitchenLoadSnapshot | null;
  isRush?: boolean;
}): ParallelPrepEstimate {
  const priors = input.priors ?? null;
  const isRush = input.isRush ?? input.load?.venueRushMode ?? false;

  const perItem = input.items.map((item) =>
    resolveItemEtaMinutes({
      productId: item.productId,
      productName: item.productName,
      menuSection: item.menuSection,
      stationTag: item.stationTag,
      priors,
      isRush,
    })
  );

  if (perItem.length === 0) {
    return {
      totalMinutes: 0,
      perItem: [],
      arrivesFirst: null,
      arrivesLast: null,
    };
  }

  const sorted = [...perItem].sort((a, b) => a.etaMinutes - b.etaMinutes);
  const totalMinutes = Math.max(...perItem.map((row) => row.etaMinutes));

  return {
    totalMinutes,
    perItem,
    arrivesFirst: sorted[0] ?? null,
    arrivesLast: sorted[sorted.length - 1] ?? null,
  };
}

export function priorsFromRhythmPrepTimeJson(
  prepTimeJson: unknown
): LocationPrepTimePriors | null {
  const parsed = parseLocationPrepTimePriors(prepTimeJson);
  if (!parsed) return null;
  return locationPrepTimePriorsFromJson(parsed);
}

function findAlternative(
  station: KitchenPrepStation,
  foodTags: string[] = []
): StationAlternative | null {
  const options = STATION_ALTERNATIVES[station] ?? [];
  return (
    options.find((option) => foodTags.includes(option.triggerFoodTag)) ?? null
  );
}

/** Suggest a positive alternative when a cart item targets an overloaded station. */
export function suggestBottleneckAlternative(input: {
  productName: string;
  productId?: string | null;
  menuSection?: string | null;
  stationTag?: string | null;
  prepStation?: string | null;
  foodTags?: string[];
  drinkFamily?: string | null;
  load: KitchenLoadSnapshot;
  minQueueDepth?: number;
}): BottleneckSuggestion | null {
  const station = resolveKitchenPrepStation({
    productName: input.productName,
    productId: input.productId,
    menuSection: input.menuSection,
    stationTag: input.stationTag,
    prepStation: input.prepStation,
    foodTags: input.foodTags,
    drinkFamily: input.drinkFamily,
  });

  const stationLoad = input.load.stations.find((row) => row.station === station);
  const minDepth = input.minQueueDepth ?? STATION_RUSH_QUEUE_THRESHOLD;
  if (!stationLoad || stationLoad.queueDepth <= minDepth) return null;

  const alternative = findAlternative(station, input.foodTags ?? []);
  if (!alternative) return null;

  return {
    insteadOf: input.productName,
    alternativeName: alternative.alternativeName,
    alternativeProductId: alternative.alternativeProductId,
    prepMinutes: alternative.prepMinutes,
    overloadedStation: station,
    queueDepth: stationLoad.queueDepth,
    reasonKey: alternative.reasonKey,
  };
}

/** Venue-wide kitchen load from guest order rows. */
export function buildVenueKitchenLoad(
  orders: Array<{
    status: string;
    order_items: Array<{
      product_id?: string | null;
      product_name: string;
      menu_section?: string | null;
      quantity?: number;
      food_tags?: string[];
      prep_station?: string | null;
      drink_family?: string | null;
    }>;
  }>
): KitchenLoadSnapshot {
  return buildKitchenLoadSnapshot(
    orders.map((order) => ({
      status: order.status,
      order_items: order.order_items,
    }))
  );
}

export function formatKitchenPulseLine(load: KitchenLoadSnapshot): string {
  const parts = load.stations
    .filter((row) => row.station !== "pass")
    .map((row) => `${row.station}(${row.queueDepth})`);
  const rush =
    load.rushStations.length > 0
      ? ` rush: ${load.rushStations.join(", ")}`
      : "";
  return `kitchen_pulse: ${parts.join(", ")}${rush}`;
}
