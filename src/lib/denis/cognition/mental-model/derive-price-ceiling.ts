import { BROWSE_BUDGET_PRICE_MAX_EUR } from "@/lib/denis/cognition/browse/browse-constants";
import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestPriceAffinity } from "@/lib/denis/cognition/mental-model/mental-model-types";

const BUDGET_CEILING_BUFFER_EUR = 3;
const MID_CEILING_BUFFER_EUR = 5;

/**
 * Max unit price (EUR) Denis should recommend from browse price signals.
 * Returns null when no ceiling applies (premium / unknown browsing).
 */
export function derivePriceCeilingEur(input: {
  browse: GuestBrowseProfile;
  priceAffinity: GuestPriceAffinity;
}): number | null {
  const stats = input.browse.priceBrowseStats;

  if (stats.viewedPriceCount === 0) {
    if (input.priceAffinity === "budget") {
      return BROWSE_BUDGET_PRICE_MAX_EUR + BUDGET_CEILING_BUFFER_EUR;
    }
    return null;
  }

  if (stats.maxViewedPrice == null) return null;

  if (stats.onlyBudgetItems || input.priceAffinity === "budget") {
    return Math.max(
      BROWSE_BUDGET_PRICE_MAX_EUR,
      stats.maxViewedPrice + BUDGET_CEILING_BUFFER_EUR
    );
  }

  if (
    stats.avgViewedPrice != null &&
    stats.avgViewedPrice <= BROWSE_BUDGET_PRICE_MAX_EUR &&
    stats.viewedPriceCount >= 2
  ) {
    return stats.maxViewedPrice + BUDGET_CEILING_BUFFER_EUR;
  }

  if (input.priceAffinity === "mid" && stats.viewedPriceCount >= 3) {
    return stats.maxViewedPrice + MID_CEILING_BUFFER_EUR;
  }

  return null;
}
