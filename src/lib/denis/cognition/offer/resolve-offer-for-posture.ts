import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type {
  BrowseSequencePattern,
  OfferReadiness,
  ResolvedOffer,
  ScoredBrowseProduct,
} from "@/lib/denis/cognition/offer/offer-types";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

function toResolvedOffer(input: {
  product: ScoredBrowseProduct | GuestBrowseProfile["viewedProducts"][0];
  resolution: ResolvedOffer["resolution"];
  score: number;
  isKitchenBlocked: boolean;
  categoryId?: string | null;
}): ResolvedOffer {
  return {
    productId: input.product.productId,
    productName: input.product.productName,
    categoryId: input.categoryId ?? null,
    resolution: input.resolution,
    score: input.score,
    dedupeKey: `offer:${input.resolution}:${input.product.productId}`,
    isKitchenBlocked: input.isKitchenBlocked,
  };
}

function venueBlocksOffer(venueOps: VenueOpsBeliefs): boolean {
  return venueOps.operatingMode === "kitchen_closed";
}

export function resolveOfferForPosture(input: {
  mental: GuestMentalModel;
  browse: GuestBrowseProfile;
  scoredProducts: ScoredBrowseProduct[];
  readiness: OfferReadiness;
  sequencePattern: BrowseSequencePattern;
  venueOps: VenueOpsBeliefs;
}): {
  primary: ResolvedOffer | null;
  alternative: ResolvedOffer | null;
  cartRecovery: ResolvedOffer | null;
  strategy: string;
} {
  if (venueBlocksOffer(input.venueOps)) {
    return {
      primary: null,
      alternative: null,
      cartRecovery: null,
      strategy: "venue_blocked",
    };
  }

  const kitchenBlocked = input.venueOps.kdsStress === "high";

  if (
    input.browse.cartAbandoned.length > 0 &&
    (input.readiness.reason === "cart_hesitation" ||
      input.mental.predictedNeed === "needs_help_choosing")
  ) {
    return {
      primary: null,
      alternative: null,
      cartRecovery: null,
      strategy: "cart_recovery_pending",
    };
  }

  const top = input.scoredProducts[0];
  if (!top) {
    return {
      primary: null,
      alternative: null,
      cartRecovery: null,
      strategy: "no_scored_product",
    };
  }

  const resolution: ResolvedOffer["resolution"] =
    top.viewCount >= 2 || input.sequencePattern === "return_view"
      ? "return_view"
      : "top_dwell";

  const primary = toResolvedOffer({
    product: top,
    resolution,
    score: top.score,
    isKitchenBlocked: kitchenBlocked,
  });

  if (kitchenBlocked) {
    const alternativeCandidate = input.scoredProducts.find(
      (product) =>
        product.productId !== top.productId &&
        product.totalDwellMs >= top.totalDwellMs * 0.5
    );
    const alternative = alternativeCandidate
      ? toResolvedOffer({
          product: alternativeCandidate,
          resolution: "kitchen_alternative",
          score: alternativeCandidate.score,
          isKitchenBlocked: false,
          categoryId: null,
        })
      : null;

    return {
      primary,
      alternative,
      cartRecovery: null,
      strategy: alternative ? "kitchen_alternative" : "kitchen_blocked_primary",
    };
  }

  if (input.mental.predictedNeed === "needs_help_choosing") {
    return {
      primary,
      alternative: null,
      cartRecovery: null,
      strategy:
        input.mental.intent === "comparing"
          ? "comparing_top_dwell"
          : "exploring_top_dwell",
    };
  }

  return {
    primary: null,
    alternative: null,
    cartRecovery: null,
    strategy: "posture_no_offer",
  };
}
