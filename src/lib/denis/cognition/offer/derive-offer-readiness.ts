import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";
import type {
  OfferReadiness,
  OfferReadinessReason,
} from "@/lib/denis/cognition/offer/offer-types";

const CART_HESITATION_MIN_SEC = 30;
const CART_HESITATION_MAX_SEC = 120;
const BROWSE_PAUSE_MIN_SEC = 8;
const BROWSE_PAUSE_MAX_SEC = 20;

function lastBrowseActionMs(spine: GuestSignalSpine): number | null {
  if (spine.actionTimestamps.length === 0) return null;
  return spine.actionTimestamps[spine.actionTimestamps.length - 1] ?? null;
}

export function deriveOfferReadiness(input: {
  spine: GuestSignalSpine;
  browse: GuestBrowseProfile;
  mental: GuestMentalModel;
  cartLineCount: number;
  nowMs: number;
}): OfferReadiness {
  const lastActionMs = lastBrowseActionMs(input.spine);
  const idleSec =
    lastActionMs != null
      ? Math.max(0, (input.nowMs - lastActionMs) / 1000)
      : Number.POSITIVE_INFINITY;

  if (
    input.mental.predictedNeed === "needs_attention" ||
    input.mental.predictedNeed === "wants_bill" ||
    input.mental.predictedNeed === "none" ||
    input.mental.predictedNeed === "ready_to_order"
  ) {
    return {
      ready: false,
      reason: "not_ready_posture",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  if (input.cartLineCount > 0) {
    return {
      ready: false,
      reason: "not_ready_commerce",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  const returnView = input.browse.viewedProducts.find(
    (product) => product.viewCount >= 2
  );
  if (returnView && idleSec >= 5) {
    return {
      ready: true,
      reason: "return_view",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  const recentAbandon = input.browse.cartAbandoned.find((item) => {
    if (!item.removedAt) return false;
    const agoSec = (input.nowMs - new Date(item.removedAt).getTime()) / 1000;
    return agoSec >= CART_HESITATION_MIN_SEC && agoSec <= CART_HESITATION_MAX_SEC;
  });
  if (recentAbandon && input.mental.pace === "indecisive") {
    return {
      ready: true,
      reason: "cart_hesitation",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  if (
    idleSec >= BROWSE_PAUSE_MIN_SEC &&
    idleSec <= BROWSE_PAUSE_MAX_SEC &&
    input.browse.viewedProducts[0]
  ) {
    return {
      ready: true,
      reason: "browse_pause",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  if (idleSec < BROWSE_PAUSE_MIN_SEC) {
    return {
      ready: false,
      reason: "not_ready_idle",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  if (
    input.mental.predictedNeed === "needs_help_choosing" ||
    input.mental.predictedNeed === "wants_drink"
  ) {
    return {
      ready: false,
      reason: "posture_ready",
      secondsSinceLastBrowseAction: idleSec,
    };
  }

  return {
    ready: false,
    reason: "not_ready_posture",
    secondsSinceLastBrowseAction: idleSec,
  };
}
