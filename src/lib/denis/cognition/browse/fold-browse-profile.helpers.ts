import {
  BROWSE_ABANDONED_DWELL_MS,
  BROWSE_BUDGET_PRICE_MAX_EUR,
  BROWSE_INTERESTED_DWELL_MS,
  BROWSE_PREMIUM_PRICE_MIN_EUR,
} from "@/lib/denis/cognition/browse/browse-constants";
import type {
  BrowseEvent,
  BrowseProductDisposition,
  GuestBrowseProfile,
} from "@/lib/denis/cognition/browse/browse-types";

export function resolveProductDisposition(input: {
  dwellMs: number;
  addedToCart: boolean;
  removedFromCart: boolean;
}): BrowseProductDisposition {
  if (input.removedFromCart) return "abandoned";
  if (input.addedToCart || input.dwellMs >= BROWSE_INTERESTED_DWELL_MS) {
    return "interested";
  }
  if (input.dwellMs > 0 && input.dwellMs < BROWSE_ABANDONED_DWELL_MS) {
    return "abandoned";
  }
  return "viewed";
}

export function isProductViewAction(action: BrowseEvent["action"]): boolean {
  return action === "view_product" || action === "close_product";
}

function foldPriceStats(
  prices: number[]
): GuestBrowseProfile["priceBrowseStats"] {
  if (!prices.length) {
    return {
      viewedPriceCount: 0,
      avgViewedPrice: null,
      maxViewedPrice: null,
      onlyBudgetItems: false,
      onlyPremiumItems: false,
    };
  }

  const sum = prices.reduce((acc, price) => acc + price, 0);
  const avg = sum / prices.length;
  const max = Math.max(...prices);

  return {
    viewedPriceCount: prices.length,
    avgViewedPrice: Math.round(avg * 100) / 100,
    maxViewedPrice: max,
    onlyBudgetItems: prices.every((price) => price <= BROWSE_BUDGET_PRICE_MAX_EUR),
    onlyPremiumItems: prices.every((price) => price >= BROWSE_PREMIUM_PRICE_MIN_EUR),
  };
}

export function finalizeBrowseProfile(
  profile: GuestBrowseProfile,
  productMap: Map<string, GuestBrowseProfile["viewedProducts"][0]>,
  categoryMap: Map<string, GuestBrowseProfile["viewedCategories"][0]>,
  categoryFocusMap: Map<string, GuestBrowseProfile["categoryFocus"][0]>,
  pricedViews: number[]
): GuestBrowseProfile {
  profile.viewedCategories = [...categoryMap.values()].sort(
    (a, b) => b.totalDwellMs - a.totalDwellMs
  );
  profile.viewedProducts = [...productMap.values()].sort(
    (a, b) => b.totalDwellMs - a.totalDwellMs
  );
  profile.categoryFocus = [...categoryFocusMap.values()].sort(
    (a, b) => b.uniqueProductCount - a.uniqueProductCount
  );

  profile.interestedProducts = profile.viewedProducts
    .filter((row) => row.disposition === "interested" && !row.addedToCart)
    .map((row) => ({
      productId: row.productId,
      productName: row.productName,
      lastViewedAt: row.lastViewedAt ?? "",
      totalDwellMs: row.totalDwellMs,
    }))
    .filter((row) => row.lastViewedAt);

  profile.abandonedProducts = profile.viewedProducts
    .filter((row) => row.disposition === "abandoned")
    .map((row) => ({
      productId: row.productId,
      productName: row.productName,
      lastViewedAt: row.lastViewedAt ?? "",
    }))
    .filter((row) => row.lastViewedAt);

  profile.priceBrowseStats = foldPriceStats(pricedViews);

  const sectionCounts = {
    food: profile.viewedProducts.filter((row) =>
      row.categoryPath.some((part) => /food|salad|burger|pizza/i.test(part))
    ).length,
    drinks: profile.viewedProducts.filter((row) =>
      row.categoryPath.some((part) => /drink|beer|wine|cocktail/i.test(part))
    ).length,
    desserts: profile.viewedProducts.filter((row) =>
      row.categoryPath.some((part) => /dessert|sweet|cake/i.test(part))
    ).length,
  };
  profile.dominantMenuSection =
    profile.browsedDesserts && sectionCounts.desserts >= sectionCounts.food
      ? "desserts"
      : profile.browsedDrinks && sectionCounts.drinks >= sectionCounts.food
        ? "drinks"
        : profile.browsedFood
          ? "food"
          : null;

  const followUp = profile.interestedProducts[0] ?? profile.viewedProducts.find(
    (row) => row.disposition === "viewed" && !row.addedToCart
  );
  profile.topFollowUpProduct = followUp
    ? {
        productId: followUp.productId,
        productName: followUp.productName,
        lastViewedAt: followUp.lastViewedAt ?? "",
        disposition: profile.viewedProducts.find((row) => row.productId === followUp.productId)?.disposition ?? "viewed",
        totalDwellMs: followUp.totalDwellMs,
      }
    : null;

  return profile;
}
