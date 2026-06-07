import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import { GUEST_OFFER_CONTEXT_VERSION } from "@/lib/denis/cognition/offer/offer-types";

/** Eval / test fixture — empty offer before fold. */
export function emptyGuestOfferContext(now = 0): GuestOfferContext {
  return {
    version: GUEST_OFFER_CONTEXT_VERSION,
    computedAt: now,
    hash: "empty",
    readiness: {
      ready: false,
      reason: "not_ready_posture",
      secondsSinceLastBrowseAction: Number.POSITIVE_INFINITY,
    },
    primary: null,
    alternative: null,
    cartRecovery: null,
    sequencePattern: "unknown",
    scoredProducts: [],
    trace: {
      strategy: "empty",
      posture: {
        predictedNeed: "none",
        intent: "arrived",
        pace: "normal",
        priceAffinity: "unknown",
      },
      browse: {
        topProductId: null,
        topDwellMs: 0,
        sequencePattern: "unknown",
        cartAbandonedCount: 0,
      },
      venue: {
        kdsStress: "normal",
        operatingMode: "normal",
      },
      readiness: {
        ready: false,
        reason: "not_ready_posture",
        secondsSinceLastBrowseAction: Number.POSITIVE_INFINITY,
      },
      timing: {
        kind: "none",
        idleSinceBrowseSec: Number.POSITIVE_INFINITY,
        speakWindow: "closed",
        ready: false,
        reason: "not_ready_posture",
      },
      conversions: [],
      nudgeStats: {},
      outcomes: [],
      pendingNudges: [],
      sessionAttachRate: 0,
      attributedRevenue: [],
      attributedRevenueCents: 0,
    },
  };
}
