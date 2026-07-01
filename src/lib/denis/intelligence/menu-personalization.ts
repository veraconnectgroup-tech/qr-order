import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestPriceAffinity } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { BasketPair } from "@/lib/denis/config/basket-pair-types";
import {
  getAllergenMeta,
  normalizeAllergenId,
  productAllergenIds,
  type AllergenId,
} from "@/lib/allergens";
import {
  DISH_PROMOTE_RATING_THRESHOLD,
  DISH_SUPPRESS_RATING_THRESHOLD,
} from "@/lib/denis/platform/feedback-intelligence";

/** Subset of guest memory fields used for menu personalization (Q3). */
export type MenuGuestMemoryProjection = {
  favoriteProductIds: string[];
  visitCount: number;
  lastVisitItemNames: string[];
  allergyLabels: string[];
};

export type MenuPersonalizationProduct = {
  id: string;
  name: string;
  price: number;
  allergens: string[] | null;
  created_at: string;
  sort_order: number;
};

export type MenuPersonalizationCategory = {
  id: string;
  name: string;
  products: MenuPersonalizationProduct[];
};

export type PersonalizedMenuBoost =
  | "favorite"
  | "trending"
  | "recommended"
  | "new"
  | null;

export type PersonalizedMenuItem = {
  productId: string;
  productName: string;
  boost: PersonalizedMenuBoost;
  allergenWarning: string | null;
  hidden: boolean;
  favoriteOrderCount: number | null;
  recommendedLabel: string | null;
};

export type PersonalizedMenuSection = {
  categoryId: string;
  categoryName: string;
  items: PersonalizedMenuItem[];
};

export type PersonalizationStripItem = {
  productId: string;
  productName: string;
  detail: string;
};

export type PersonalizationStripChip = {
  productId: string;
  productName: string;
  label: string;
  kind: Exclude<PersonalizedMenuBoost, null> | "favorite";
};

export type PersonalizationMeta = {
  favorites: PersonalizationStripItem[];
  trending: PersonalizationStripItem[];
  newest: PersonalizationStripItem[];
  hiddenAllergenCount: number;
  strip: PersonalizationStripChip[];
};

export type VkgPairingHint = {
  productId: string;
  productName: string;
  anchorProductName: string;
};

export const MIN_TRENDING_ORDERS_TODAY = 5;
export const TOP_TRENDING_COUNT = 3;
export const NEW_ITEM_MAX_AGE_DAYS = 7;
export const MIN_FAVORITE_PRIOR_VISITS = 2;

const MS_PER_DAY = 86_400_000;

function normalizeGuestAllergens(allergens: string[]): Set<AllergenId> {
  const ids = new Set<AllergenId>();
  for (const raw of allergens) {
    const id = normalizeAllergenId(raw);
    if (id) ids.add(id);
  }
  return ids;
}

function resolvePriceAffinity(
  value: GuestPriceAffinity | "budget" | "mid" | "premium"
): "budget" | "mid" | "premium" {
  if (value === "budget" || value === "premium") return value;
  return "mid";
}

function productAgeDays(createdAt: string, nowMs: number): number | null {
  const parsed = Date.parse(createdAt);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((nowMs - parsed) / MS_PER_DAY));
}

function isNewProduct(createdAt: string, nowMs: number): boolean {
  const age = productAgeDays(createdAt, nowMs);
  return age != null && age < NEW_ITEM_MAX_AGE_DAYS;
}

function favoriteOrderCount(
  productId: string,
  guest: MenuGuestMemoryProjection | null,
  productOrderCounts?: Record<string, number>
): number {
  if (productOrderCounts?.[productId] != null) {
    return productOrderCounts[productId]!;
  }
  if (!guest) return 0;
  if (!guest.favoriteProductIds.includes(productId)) return 0;
  return Math.max(MIN_FAVORITE_PRIOR_VISITS, guest.visitCount);
}

function isFavoriteProduct(
  product: MenuPersonalizationProduct,
  guest: MenuGuestMemoryProjection | null
): boolean {
  if (!guest || guest.visitCount < MIN_FAVORITE_PRIOR_VISITS) return false;
  if (guest.favoriteProductIds.includes(product.id)) return true;

  const name = product.name.trim().toLowerCase();
  return guest.lastVisitItemNames.some((item) => {
    const normalized = item.trim().toLowerCase();
    return normalized === name || name.includes(normalized) || normalized.includes(name);
  });
}

function buildAllergenWarning(
  allergens: string[] | null,
  guestAllergenIds: Set<AllergenId>,
  language: string
): string | null {
  const productIds = productAllergenIds(allergens);
  const matching = productIds.filter((id) => guestAllergenIds.has(id));
  if (matching.length === 0) return null;

  const labels = matching.map((id) => getAllergenMeta(id).label);
  return language.startsWith("en")
    ? `Contains ${labels.join(", ")}`
    : `Sadrži ${labels.join(", ")}`;
}

function productMatchesGuestAllergens(
  allergens: string[] | null,
  guestAllergenIds: Set<AllergenId>
): boolean {
  if (guestAllergenIds.size === 0) return false;
  return productAllergenIds(allergens).some((id) => guestAllergenIds.has(id));
}

function resolveRecommendedLabel(input: {
  productId: string;
  guest: MenuGuestMemoryProjection | null;
  basketPairs: BasketPair[];
  vkgPairings: VkgPairingHint[];
  language: string;
}): string | null {
  const vkgMatch = input.vkgPairings.find(
    (pair) => pair.productId === input.productId
  );
  if (vkgMatch) {
    return input.language.startsWith("en")
      ? `Recommended with your ${vkgMatch.anchorProductName}`
      : `Preporučeno uz ${vkgMatch.anchorProductName}`;
  }

  if (!input.guest) return null;

  for (const pair of input.basketPairs) {
    const anchorMatch =
      input.guest.favoriteProductIds.includes(pair.productA) ||
      input.guest.lastVisitItemNames.some(
        (name) => name.trim().toLowerCase() === pair.productAName.trim().toLowerCase()
      );

    if (!anchorMatch || pair.productB !== input.productId) continue;

    return input.language.startsWith("en")
      ? `Often with your ${pair.productAName}: ${pair.productBName}`
      : `Često uz vaš ${pair.productAName}: ${pair.productBName}`;
  }

  return null;
}

export function personalizationBoostLabel(
  boost: PersonalizedMenuBoost,
  language = "sr"
): string | null {
  switch (boost) {
    case "favorite":
      return language.startsWith("en") ? "⭐ Your favorite" : "⭐ Vaš favorit";
    case "trending":
      return language.startsWith("en")
        ? "🔥 Popular today"
        : "🔥 Popularno danas";
    case "new":
      return language.startsWith("en") ? "✨ New" : "✨ Novo";
    case "recommended":
      return null;
    default:
      return null;
  }
}

export function buildPersonalizationStrip(
  meta: Pick<PersonalizationMeta, "favorites" | "trending" | "newest">,
  language = "sr"
): PersonalizationStripChip[] {
  const chips: PersonalizationStripChip[] = [];

  for (const favorite of meta.favorites.slice(0, 2)) {
    chips.push({
      productId: favorite.productId,
      productName: favorite.productName,
      kind: "favorite",
      label: language.startsWith("en")
        ? `Your ${favorite.productName} again?`
        : `Ponovo vaš ${favorite.productName}?`,
    });
  }

  for (const trending of meta.trending.slice(0, 2)) {
    chips.push({
      productId: trending.productId,
      productName: trending.productName,
      kind: "trending",
      label: language.startsWith("en")
        ? `🔥 Popular today: ${trending.productName}`
        : `🔥 Danas popularan ${trending.productName}`,
    });
  }

  for (const item of meta.newest.slice(0, 1)) {
    chips.push({
      productId: item.productId,
      productName: item.productName,
      kind: "new",
      label: language.startsWith("en")
        ? `✨ New: ${item.productName}`
        : `✨ Novo: ${item.productName}`,
    });
  }

  return chips.slice(0, 4);
}

function compareByPriceAffinity(
  a: MenuPersonalizationProduct,
  b: MenuPersonalizationProduct,
  affinity: "budget" | "mid" | "premium"
): number {
  if (affinity === "budget") return a.price - b.price || a.sort_order - b.sort_order;
  if (affinity === "premium") return b.price - a.price || a.sort_order - b.sort_order;
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

function sortPersonalizedItems(
  items: PersonalizedMenuItem[],
  productsById: Map<string, MenuPersonalizationProduct>,
  affinity: "budget" | "mid" | "premium",
  menuEngineeringCategories?: Record<
    string,
    import("@/lib/denis/platform/menu-engineering").MenuEngineeringCategory
  >,
  productFeedbackRatings?: Record<string, number>
): PersonalizedMenuItem[] {
  return [...items].sort((left, right) => {
    const leftFeedback = productFeedbackRatings?.[left.productId];
    const rightFeedback = productFeedbackRatings?.[right.productId];
    const leftSuppress =
      leftFeedback != null && leftFeedback < DISH_SUPPRESS_RATING_THRESHOLD ? 1 : 0;
    const rightSuppress =
      rightFeedback != null && rightFeedback < DISH_SUPPRESS_RATING_THRESHOLD ? 1 : 0;
    if (leftSuppress !== rightSuppress) return leftSuppress - rightSuppress;

    const leftPromote =
      leftFeedback != null && leftFeedback > DISH_PROMOTE_RATING_THRESHOLD ? 1 : 0;
    const rightPromote =
      rightFeedback != null && rightFeedback > DISH_PROMOTE_RATING_THRESHOLD ? 1 : 0;
    if (leftPromote !== rightPromote) return rightPromote - leftPromote;

    const leftStar =
      menuEngineeringCategories?.[left.productId] === "star" ? 1 : 0;
    const rightStar =
      menuEngineeringCategories?.[right.productId] === "star" ? 1 : 0;
    if (leftStar !== rightStar) return rightStar - leftStar;

    const leftBlocked =
      menuEngineeringCategories?.[left.productId] === "dog" ? 1 : 0;
    const rightBlocked =
      menuEngineeringCategories?.[right.productId] === "dog" ? 1 : 0;
    if (leftBlocked !== rightBlocked) return leftBlocked - rightBlocked;

    const leftFavorite = left.boost === "favorite" ? 1 : 0;
    const rightFavorite = right.boost === "favorite" ? 1 : 0;
    if (leftFavorite !== rightFavorite) return rightFavorite - leftFavorite;

    const leftProduct = productsById.get(left.productId);
    const rightProduct = productsById.get(right.productId);
    if (leftProduct && rightProduct) {
      const priceCmp = compareByPriceAffinity(leftProduct, rightProduct, affinity);
      if (priceCmp !== 0) return priceCmp;
    }

    return left.productName.localeCompare(right.productName);
  });
}

function buildTrendingSet(
  trendingProductIds: string[],
  orderCountsToday: Record<string, number>
): Set<string> {
  const ranked = trendingProductIds
    .map((productId) => ({
      productId,
      count: orderCountsToday[productId] ?? 0,
    }))
    .filter((row) => row.count >= MIN_TRENDING_ORDERS_TODAY)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_TRENDING_COUNT);

  return new Set(ranked.map((row) => row.productId));
}

/** Personalize menu order, badges, and allergen visibility per guest (Q3). */
export function personalizeMenu(input: {
  fullMenu: MenuPersonalizationCategory[];
  guestMemory: MenuGuestMemoryProjection | null;
  guestAllergens: string[];
  browseProfile: GuestBrowseProfile;
  priceAffinity: GuestPriceAffinity | "budget" | "mid" | "premium";
  trendingProductIds: string[];
  trendingOrderCountsToday?: Record<string, number>;
  basketPairs?: BasketPair[];
  vkgPairings?: VkgPairingHint[];
  productOrderCounts?: Record<string, number>;
  menuEngineeringCategories?: Record<
    string,
    import("@/lib/denis/platform/menu-engineering").MenuEngineeringCategory
  >;
  /** Average guest feedback rating per product — Denis suppresses <3.5, promotes >4.5. */
  productFeedbackRatings?: Record<string, number>;
  language?: string;
  nowMs?: number;
}): { sections: PersonalizedMenuSection[]; meta: PersonalizationMeta } {
  const nowMs = input.nowMs ?? Date.now();
  const language = input.language ?? "sr";
  const affinity = resolvePriceAffinity(input.priceAffinity);
  const guestAllergenIds = normalizeGuestAllergens([
    ...input.guestAllergens,
    ...(input.guestMemory?.allergyLabels ?? []),
  ]);
  const trending = buildTrendingSet(
    input.trendingProductIds,
    input.trendingOrderCountsToday ?? {}
  );
  const basketPairs = input.basketPairs ?? [];
  const vkgPairings = input.vkgPairings ?? [];

  const favorites: PersonalizationStripItem[] = [];
  const trendingStrip: PersonalizationStripItem[] = [];
  const newest: PersonalizationStripItem[] = [];
  let hiddenAllergenCount = 0;

  const sections: PersonalizedMenuSection[] = input.fullMenu.map((category) => {
    const productsById = new Map(category.products.map((product) => [product.id, product]));
    const items: PersonalizedMenuItem[] = category.products.map((product) => {
      const hidden = productMatchesGuestAllergens(product.allergens, guestAllergenIds);
      if (hidden) hiddenAllergenCount += 1;

      const favorite = isFavoriteProduct(product, input.guestMemory);
      const orderCount = favorite
        ? favoriteOrderCount(product.id, input.guestMemory, input.productOrderCounts)
        : null;
      const recommendedLabel = resolveRecommendedLabel({
        productId: product.id,
        guest: input.guestMemory,
        basketPairs,
        vkgPairings,
        language,
      });

      let boost: PersonalizedMenuBoost = null;
      const feedbackRating = input.productFeedbackRatings?.[product.id];
      if (favorite) boost = "favorite";
      else if (trending.has(product.id)) boost = "trending";
      else if (isNewProduct(product.created_at, nowMs)) boost = "new";
      else if (
        feedbackRating != null &&
        feedbackRating > DISH_PROMOTE_RATING_THRESHOLD
      ) {
        boost = "recommended";
      } else if (recommendedLabel) boost = "recommended";

      const feedbackRecommendedLabel =
        feedbackRating != null && feedbackRating > DISH_PROMOTE_RATING_THRESHOLD
          ? language.startsWith("en")
            ? "⭐ Guest favorite"
            : "⭐ Omiljeno kod gostiju"
          : null;

      const item: PersonalizedMenuItem = {
        productId: product.id,
        productName: product.name,
        boost,
        allergenWarning: buildAllergenWarning(
          product.allergens,
          guestAllergenIds,
          language
        ),
        hidden,
        favoriteOrderCount: orderCount,
        recommendedLabel: feedbackRecommendedLabel ?? recommendedLabel,
      };

      if (favorite && orderCount != null) {
        favorites.push({
          productId: product.id,
          productName: product.name,
          detail:
            language.startsWith("en")
              ? `Ordered ${orderCount}×`
              : `Naručeni ${orderCount}×`,
        });
      }

      const trendingCount = input.trendingOrderCountsToday?.[product.id] ?? 0;
      if (trending.has(product.id)) {
        trendingStrip.push({
          productId: product.id,
          productName: product.name,
          detail:
            language.startsWith("en")
              ? `${trendingCount} orders today`
              : `${trendingCount} narudžbi danas`,
        });
      }

      const ageDays = productAgeDays(product.created_at, nowMs);
      if (ageDays != null && ageDays < NEW_ITEM_MAX_AGE_DAYS) {
        newest.push({
          productId: product.id,
          productName: product.name,
          detail:
            language.startsWith("en")
              ? `Added ${ageDays} days ago`
              : `Dodano pre ${ageDays} dana`,
        });
      }

      return item;
    });

    return {
      categoryId: category.id,
      categoryName: category.name,
      items:       sortPersonalizedItems(
        items,
        productsById,
        affinity,
        input.menuEngineeringCategories,
        input.productFeedbackRatings
      ),
    };
  });

  const dedupe = (rows: PersonalizationStripItem[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.productId)) return false;
      seen.add(row.productId);
      return true;
    });
  };

  const metaBase = {
    favorites: dedupe(favorites).slice(0, 6),
    trending: dedupe(trendingStrip).slice(0, TOP_TRENDING_COUNT),
    newest: dedupe(newest)
      .sort((a, b) => a.detail.localeCompare(b.detail))
      .slice(0, 6),
    hiddenAllergenCount,
  };

  return {
    sections,
    meta: {
      ...metaBase,
      strip: buildPersonalizationStrip(metaBase, language),
    },
  };
}

/** Reorder category products using personalized sections (visible items only). */
export function reorderCategoriesByPersonalization<T extends { id: string; products: Array<{ id: string }> }>(
  categories: T[],
  sections: PersonalizedMenuSection[],
  options?: { showHiddenAllergens?: boolean }
): T[] {
  const showHidden = options?.showHiddenAllergens ?? false;
  const orderByCategory = new Map(
    sections.map((section) => [
      section.categoryId,
      section.items
        .filter((item) => showHidden || !item.hidden)
        .map((item) => item.productId),
    ])
  );

  return categories.map((category) => {
    const order = orderByCategory.get(category.id);
    if (!order?.length) {
      if (showHidden) return category;
      return {
        ...category,
        products: category.products.filter((product) => {
          const section = sections.find((row) => row.categoryId === category.id);
          const item = section?.items.find((row) => row.productId === product.id);
          return !item?.hidden;
        }),
      };
    }

    const byId = new Map(category.products.map((product) => [product.id, product]));
    const products = order
      .map((productId) => byId.get(productId))
      .filter((product): product is T["products"][number] => product != null);

    if (showHidden) {
      for (const product of category.products) {
        if (!order.includes(product.id)) products.push(product);
      }
    }

    return { ...category, products };
  });
}

export function personalizationBadgeByProductId(
  sections: PersonalizedMenuSection[]
): Map<
  string,
  Pick<PersonalizedMenuItem, "boost" | "allergenWarning" | "recommendedLabel">
> {
  const map = new Map<
    string,
    Pick<PersonalizedMenuItem, "boost" | "allergenWarning" | "recommendedLabel">
  >();

  for (const section of sections) {
    for (const item of section.items) {
      map.set(item.productId, {
        boost: item.boost,
        allergenWarning: item.allergenWarning,
        recommendedLabel: item.recommendedLabel,
      });
    }
  }

  return map;
}
