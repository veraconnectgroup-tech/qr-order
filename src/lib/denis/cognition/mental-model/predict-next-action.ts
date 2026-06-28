import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type {
  GuestIntent,
  GuestNextActionPrediction,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  hasFoodTag,
  type ProductSemanticMeta,
} from "@/lib/denis/catalog/product-semantics";
import type { BasketPair } from "@/lib/denis/config/basket-pair-types";

const MIN_BURGER_DWELL_MS = 90_000;
const PARALYSIS_VIEW_THRESHOLD = 5;
const PARALYSIS_PROBABILITY = 0.7;
const BUNDLE_PROBABILITY = 0.85;
const BASKET_PAIR_MIN_CONFIDENCE = 65;

type ProductCatalogMeta = Record<string, ProductSemanticMeta>;

function none(): GuestNextActionPrediction {
  return {
    action: "none",
    probability: 0,
    label: "",
    preloadProducts: [],
    triggerProactiveHelp: false,
  };
}

function metaForProduct(
  productId: string,
  catalog?: ProductCatalogMeta
): ProductSemanticMeta {
  return catalog?.[productId] ?? { foodTags: [], menuSection: null };
}

function findBrowsedByFoodTag(
  browse: GuestBrowseProfile,
  catalog: ProductCatalogMeta | undefined,
  tag: string
) {
  return browse.viewedProducts.find((product) =>
    hasFoodTag(metaForProduct(product.productId, catalog), tag)
  );
}

function findBasketPairSuggestion(input: {
  browse: GuestBrowseProfile;
  basketPairs?: BasketPair[];
}): GuestNextActionPrediction | null {
  if (!input.basketPairs?.length) return null;

  for (const viewed of input.browse.viewedProducts) {
    const anchorPairs = input.basketPairs.filter(
      (pair) =>
        pair.productA === viewed.productId &&
        pair.confidencePercent >= BASKET_PAIR_MIN_CONFIDENCE
    );
    if (!anchorPairs.length) continue;

    const best = anchorPairs.sort(
      (a, b) => b.confidencePercent - a.confidencePercent
    )[0]!;
    const paired = input.browse.viewedProducts.find(
      (product) => product.productId === best.productB
    );

    return {
      action: "order_bundle",
      probability: Math.min(0.9, best.confidencePercent / 100),
      label: "learned_basket_pair",
      preloadProducts: [
        { productId: viewed.productId, productName: viewed.productName },
        {
          productId: best.productB,
          productName: paired?.productName ?? best.productBName,
        },
      ],
      triggerProactiveHelp: false,
    };
  }

  return null;
}

/** Predict the guest's next move from browse + cart signals (L2). */
export function predictNextAction(input: {
  browse: GuestBrowseProfile;
  cartLineCount: number;
  intent: GuestIntent;
  productCatalog?: ProductCatalogMeta;
  basketPairs?: BasketPair[];
}): GuestNextActionPrediction {
  const addedAny =
    input.cartLineCount > 0 ||
    input.browse.viewedProducts.some((product) => product.addedToCart);

  const uniqueViewed = input.browse.viewedProducts.length;
  if (
    uniqueViewed >= PARALYSIS_VIEW_THRESHOLD &&
    !addedAny &&
    (input.intent === "exploring" || input.intent === "comparing")
  ) {
    return {
      action: "needs_help",
      probability: PARALYSIS_PROBABILITY,
      label: "browse_paralysis",
      preloadProducts: input.browse.viewedProducts.slice(0, 4).map((product) => ({
        productId: product.productId,
        productName: product.productName,
      })),
      triggerProactiveHelp: true,
    };
  }

  const pairSuggestion = findBasketPairSuggestion({
    browse: input.browse,
    basketPairs: input.basketPairs,
  });
  if (pairSuggestion && !addedAny) {
    return pairSuggestion;
  }

  const burger = findBrowsedByFoodTag(input.browse, input.productCatalog, "burger");
  const fries = findBrowsedByFoodTag(
    input.browse,
    input.productCatalog,
    "fries"
  );

  if (
    burger &&
    fries &&
    !addedAny &&
    burger.totalDwellMs >= MIN_BURGER_DWELL_MS
  ) {
    return {
      action: "order_bundle",
      probability: BUNDLE_PROBABILITY,
      label: "burger_fries_combo",
      preloadProducts: [
        { productId: burger.productId, productName: burger.productName },
        { productId: fries.productId, productName: fries.productName },
      ],
      triggerProactiveHelp: false,
    };
  }

  if (input.browse.topFollowUpProduct && input.intent === "comparing") {
    const followUp = input.browse.topFollowUpProduct;
    const viewed = input.browse.viewedProducts.find(
      (product) => product.productId === followUp.productId
    );
    if (!viewed?.addedToCart) {
      return {
        action: "add_to_cart",
        probability: 0.55,
        label: "follow_up_product",
        preloadProducts: [
          { productId: followUp.productId, productName: followUp.productName },
        ],
        triggerProactiveHelp: false,
      };
    }
  }

  if (input.intent === "decided" || input.intent === "ordering") {
    return {
      action: "checkout",
      probability: 0.6,
      label: "ready_checkout",
      preloadProducts: [],
      triggerProactiveHelp: false,
    };
  }

  return none();
}
