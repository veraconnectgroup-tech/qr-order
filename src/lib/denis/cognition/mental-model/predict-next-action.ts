import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type {
  GuestIntent,
  GuestNextActionPrediction,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

const BURGER_PATTERN = /\bburger\b/i;
const FRIES_PATTERN = /\b(fri(es)?|pomfrit|pommes)\b/i;
const MIN_BURGER_DWELL_MS = 90_000;
const PARALYSIS_VIEW_THRESHOLD = 5;
const PARALYSIS_PROBABILITY = 0.7;
const BUNDLE_PROBABILITY = 0.85;

function none(): GuestNextActionPrediction {
  return {
    action: "none",
    probability: 0,
    label: "",
    preloadProducts: [],
    triggerProactiveHelp: false,
  };
}

function findBrowsedProduct(
  browse: GuestBrowseProfile,
  pattern: RegExp
) {
  return browse.viewedProducts.find((product) =>
    pattern.test(product.productName)
  );
}

/** Predict the guest's next move from browse + cart signals (L2). */
export function predictNextAction(input: {
  browse: GuestBrowseProfile;
  cartLineCount: number;
  intent: GuestIntent;
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

  const burger = findBrowsedProduct(input.browse, BURGER_PATTERN);
  const fries = findBrowsedProduct(input.browse, FRIES_PATTERN);

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
