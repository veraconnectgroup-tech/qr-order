import { localSlotFromDate } from "@/lib/denis/config/resolve-rhythm-priors";

export type PrepStation = "kitchen" | "bar" | "dessert";

export type PrepTimeEstimateConfidence = "high" | "low" | "none";

export type PrepTimeEstimate = {
  etaMinutes: number | null;
  confidence: PrepTimeEstimateConfidence;
};

export type PrepTimeEstimateItem = {
  productId: string;
  station: PrepStation;
};

export type ProductPrepTimePrior = {
  productId: string;
  p50Minutes: number;
  p90Minutes: number;
  sampleCount: number;
  rushMultiplier: number;
};

export type StationPrepTimePrior = {
  p50: number;
  p90: number;
  samples: number;
  rushMultiplier: number;
};

export type LocationPrepTimePriorsJson = {
  version: 1;
  byProduct: Record<string, ProductPrepTimePrior>;
  byStation: Partial<Record<PrepStation, StationPrepTimePrior>>;
  updatedAt: string;
};

export type LocationPrepTimePriors = {
  byProduct: Map<string, ProductPrepTimePrior>;
  byStation: Map<PrepStation, StationPrepTimePrior>;
};

const HIGH_CONFIDENCE_SAMPLES = 5;

export function emptyLocationPrepTimePriorsJson(): LocationPrepTimePriorsJson {
  return {
    version: 1,
    byProduct: {},
    byStation: {},
    updatedAt: new Date().toISOString(),
  };
}

export function parseLocationPrepTimePriors(
  value: unknown
): LocationPrepTimePriorsJson | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (typeof record.byProduct !== "object" || !record.byProduct) return null;
  if (typeof record.byStation !== "object" || !record.byStation) return null;
  return value as LocationPrepTimePriorsJson;
}

export function locationPrepTimePriorsFromJson(
  json: LocationPrepTimePriorsJson
): LocationPrepTimePriors {
  return {
    byProduct: new Map(Object.entries(json.byProduct)),
    byStation: new Map(
      Object.entries(json.byStation) as Array<[PrepStation, StationPrepTimePrior]>
    ),
  };
}

function applyRush(minutes: number, multiplier: number, isRush: boolean): number {
  if (!isRush) return minutes;
  return Math.round(minutes * multiplier);
}

function resolveItemEstimate(
  priors: LocationPrepTimePriors,
  item: PrepTimeEstimateItem,
  isRush: boolean
): PrepTimeEstimate {
  const product = priors.byProduct.get(item.productId);
  const station = priors.byStation.get(item.station);

  if (product && product.sampleCount >= HIGH_CONFIDENCE_SAMPLES) {
    return {
      etaMinutes: applyRush(
        product.p50Minutes,
        product.rushMultiplier,
        isRush
      ),
      confidence: "high",
    };
  }

  if (station && station.samples > 0) {
    return {
      etaMinutes: applyRush(station.p50, station.rushMultiplier, isRush),
      confidence: "low",
    };
  }

  if (product && product.sampleCount > 0) {
    return {
      etaMinutes: applyRush(
        product.p50Minutes,
        product.rushMultiplier,
        isRush
      ),
      confidence: "low",
    };
  }

  return { etaMinutes: null, confidence: "none" };
}

export function resolvePrepTimeEstimate(
  priors: LocationPrepTimePriors | null | undefined,
  items: PrepTimeEstimateItem[],
  isRush: boolean
): PrepTimeEstimate {
  if (!priors || items.length === 0) {
    return { etaMinutes: null, confidence: "none" };
  }

  let best: PrepTimeEstimate = { etaMinutes: null, confidence: "none" };

  for (const item of items) {
    const estimate = resolveItemEstimate(priors, item, isRush);
    if (estimate.etaMinutes == null) continue;

    if (best.etaMinutes == null || estimate.etaMinutes > best.etaMinutes) {
      best = estimate;
      continue;
    }

    if (
      estimate.etaMinutes === best.etaMinutes &&
      estimate.confidence === "high" &&
      best.confidence !== "high"
    ) {
      best = estimate;
    }
  }

  return best;
}

export function formatPrepTimeConfidence(
  confidence: PrepTimeEstimateConfidence
): string {
  switch (confidence) {
    case "high":
      return "high confidence";
    case "low":
      return "approximate";
    default:
      return "unknown";
  }
}

export type PerItemPrepCommunication = {
  productName: string;
  etaMinutes: number;
};

/** Per-item prep copy — not generic "15-20 min". */
export function formatPerItemPrepCommunication(input: {
  perItem: PerItemPrepCommunication[];
  language?: string | null;
}): string | null {
  if (input.perItem.length === 0) return null;

  const lang = input.language?.trim().slice(0, 2) ?? "sr";
  const sorted = [...input.perItem].sort((a, b) => b.etaMinutes - a.etaMinutes);
  const longest = sorted[0]!;
  const faster = sorted.slice(1).filter((row) => row.etaMinutes < longest.etaMinutes);

  if (lang === "de") {
    const lead = `${longest.productName}: ca. ${longest.etaMinutes} Min.`;
    if (faster.length === 0) return lead;
    return `${lead} ${faster.map((row) => `${row.productName} kommt früher`).join(", ")}.`;
  }

  if (lang === "en") {
    const lead = `${longest.productName}: ~${longest.etaMinutes} min.`;
    if (faster.length === 0) return lead;
    const names = faster.map((row) => row.productName).join(", ");
    return `${lead} ${names} arrive${faster.length > 1 ? "" : "s"} sooner.`;
  }

  const lead = `${longest.productName}: oko ${longest.etaMinutes} minuta.`;
  if (faster.length === 0) return lead;
  const names = faster.map((row) => row.productName).join(", ");
  return `${lead} ${names} stiže${faster.length > 1 ? "u" : ""} pre toga.`;
}

export function menuSectionToStation(section: string | null): PrepStation {
  if (section === "drinks") return "bar";
  if (section === "desserts") return "dessert";
  return "kitchen";
}

export function prepTimeFactsFromDeliveredOrder(
  order: {
    preparing_at: string | null;
    delivered_at: string | null;
    order_items: Array<{
      product_id: string | null;
      product_name: string;
      menu_section: string | null;
    }> | null;
  },
  context: {
    locationId: string;
    timezone: string;
    isRush?: boolean;
  }
) {
  if (!order.preparing_at || !order.delivered_at) return [];

  const start = new Date(order.preparing_at).getTime();
  const end = new Date(order.delivered_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const prepMinutes = Math.round((end - start) / 60_000);
  const slot = localSlotFromDate(new Date(order.delivered_at), context.timezone);
  const items = order.order_items ?? [];

  return items
    .map((item) => {
      const productId = item.product_id?.trim();
      if (!productId) return null;
      return {
        locationId: context.locationId,
        productId,
        productName: item.product_name,
        menuSection: item.menu_section,
        station: menuSectionToStation(item.menu_section),
        prepMinutes,
        dayOfWeek: slot.dow,
        hour: slot.hour,
        isRush: context.isRush ?? false,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}
