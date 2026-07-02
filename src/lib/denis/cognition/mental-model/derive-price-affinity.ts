import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { BROWSE_BUDGET_PRICE_MAX_EUR } from "@/lib/denis/cognition/browse/browse-constants";
import type { GuestPriceAffinity } from "@/lib/denis/cognition/mental-model/mental-model-types";

/** Browse dwell + unit-price heuristics for mental model price_affinity. */
export function derivePriceAffinity(browse: GuestBrowseProfile): GuestPriceAffinity {
  if (browse.eventCount === 0) return "unknown";

  const stats = browse.priceBrowseStats;
  if (stats.viewedPriceCount >= 1 && stats.maxViewedPrice != null) {
    if (stats.onlyBudgetItems) return "budget";
    if (
      stats.viewedPriceCount >= 2 &&
      stats.maxViewedPrice <= BROWSE_BUDGET_PRICE_MAX_EUR
    ) {
      return "budget";
    }
  }

  if (stats.viewedPriceCount >= 2) {
    if (stats.onlyPremiumItems) return "premium";
    if (
      stats.avgViewedPrice != null &&
      stats.maxViewedPrice != null &&
      stats.avgViewedPrice < stats.maxViewedPrice * 0.75
    ) {
      return "budget";
    }
  }

  const avgDwell = browse.totalBrowseMs / browse.eventCount;
  if (avgDwell >= 7500) return "premium";
  if (avgDwell <= 2500) return "budget";
  return "mid";
}
