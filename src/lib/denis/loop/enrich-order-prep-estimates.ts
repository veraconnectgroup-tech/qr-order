import { menuSectionToStation } from "@/lib/commerce/projections/collect-prep-time-facts";
import {
  locationPrepTimePriorsFromJson,
  parseLocationPrepTimePriors,
  resolvePrepTimeEstimate,
  type LocationPrepTimePriors,
  type PrepTimeEstimateItem,
} from "@/lib/denis/config/prep-time-priors";
import type { OrderFact } from "@/lib/denis/loop/types";

export function prepTimePriorsFromRhythmPriorsJson(
  priors: { prepTime?: unknown } | null | undefined
): LocationPrepTimePriors | null {
  const parsed = parseLocationPrepTimePriors(priors?.prepTime);
  if (!parsed) return null;
  return locationPrepTimePriorsFromJson(parsed);
}

function estimateItemsForOrder(order: OrderFact): PrepTimeEstimateItem[] {
  return order.items
    .map((item) => {
      const productId = item.productId?.trim();
      if (!productId) return null;
      return {
        productId,
        station: menuSectionToStation(item.menuSection ?? null),
      };
    })
    .filter((item): item is PrepTimeEstimateItem => item != null);
}

/** Fill OrderFact.estimatedPrepMinutes from learned priors at FOLD (A2). */
export function enrichOrderFactsWithPrepEstimates(
  orders: OrderFact[],
  priors: LocationPrepTimePriors | null | undefined,
  isRush: boolean
): OrderFact[] {
  if (!priors) return orders;

  return orders.map((order) => {
    if (
      order.estimatedPrepMinutes != null ||
      ["delivered", "cancelled", "rejected"].includes(order.status)
    ) {
      return order;
    }

    const estimate = resolvePrepTimeEstimate(
      priors,
      estimateItemsForOrder(order),
      isRush
    );

    if (estimate.etaMinutes == null) {
      return order;
    }

    return {
      ...order,
      estimatedPrepMinutes: estimate.etaMinutes,
      prepEstimateConfidence: estimate.confidence,
    };
  });
}
