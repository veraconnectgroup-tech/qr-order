import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type {
  GuestPriceAffinity,
  GuestSpendPrediction,
  GuestSpendTier,
  GuestUpsellTier,
} from "@/lib/denis/cognition/mental-model/mental-model-types";

const LOW_PER_GUEST_CENTS = 1800;
const HIGH_PER_GUEST_CENTS = 4500;
const LUNCH_DISCOUNT = 0.85;
const EVENING_PREMIUM = 1.15;

function tierFromPerGuestCents(cents: number): GuestSpendTier {
  if (cents < LOW_PER_GUEST_CENTS) return "low";
  if (cents >= HIGH_PER_GUEST_CENTS) return "high";
  return "mid";
}

function upsellTierFromSpend(tier: GuestSpendTier): GuestUpsellTier {
  if (tier === "low") return "value";
  if (tier === "high") return "premium";
  return "standard";
}

function mergePriceAffinity(
  tier: GuestSpendTier,
  affinity: GuestPriceAffinity
): GuestPriceAffinity {
  if (affinity !== "unknown") return affinity;
  if (tier === "low") return "budget";
  if (tier === "high") return "premium";
  return "mid";
}

/** Predict check size + upsell tier from browse, party, and time (L2). */
export function predictGuestSpend(input: {
  browse: GuestBrowseProfile;
  partySize: number;
  localHour: number;
  sessionDurationMinutes: number;
  priceAffinity: GuestPriceAffinity;
}): GuestSpendPrediction & { refinedPriceAffinity: GuestPriceAffinity } {
  const partySize = Math.max(1, input.partySize);
  const stats = input.browse.priceBrowseStats;

  let perGuestCents = 2800;

  if (stats.avgViewedPrice != null && stats.viewedPriceCount >= 1) {
    perGuestCents = Math.round(stats.avgViewedPrice * 100);
    if (stats.maxViewedPrice != null) {
      perGuestCents = Math.round(
        perGuestCents * 0.7 + stats.maxViewedPrice * 100 * 0.3
      );
    }
  } else if (stats.onlyBudgetItems) {
    perGuestCents = 1400;
  } else if (stats.onlyPremiumItems) {
    perGuestCents = 5200;
  }

  if (input.localHour >= 11 && input.localHour <= 14) {
    perGuestCents = Math.round(perGuestCents * LUNCH_DISCOUNT);
  } else if (input.localHour >= 19 && input.localHour <= 22) {
    perGuestCents = Math.round(perGuestCents * EVENING_PREMIUM);
  }

  if (input.sessionDurationMinutes >= 75) {
    perGuestCents = Math.round(perGuestCents * 1.12);
  } else if (input.sessionDurationMinutes <= 25) {
    perGuestCents = Math.round(perGuestCents * 0.88);
  }

  perGuestCents = Math.max(800, perGuestCents);
  const predictedTotalCents = perGuestCents * partySize;
  const tier = tierFromPerGuestCents(perGuestCents);

  let confidence = 0.35;
  if (stats.viewedPriceCount >= 2) confidence = 0.72;
  else if (input.browse.eventCount >= 3) confidence = 0.55;

  return {
    tier,
    predictedTotalCents,
    perGuestCents,
    confidence: Math.round(confidence * 100) / 100,
    upsellTier: upsellTierFromSpend(tier),
    refinedPriceAffinity: mergePriceAffinity(tier, input.priceAffinity),
  };
}
