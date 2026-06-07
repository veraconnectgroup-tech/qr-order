import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type {
  BrowseSequenceEntry,
  OfferReadinessReason,
  OfferTiming,
  OfferTimingKind,
} from "@/lib/denis/cognition/offer/offer-types";

export const BROWSE_PAUSE_MIN_SEC = 8;
export const CART_HESITATION_MIN_SEC = 30;
export const CART_HESITATION_MAX_SEC = 120;
export const RETURN_VIEW_MIN_SEC = 5;

function lastViewProductMs(sequence: BrowseSequenceEntry[]): number | null {
  let last: number | null = null;
  for (const entry of sequence) {
    if (entry.action !== "view_product") continue;
    const at = new Date(entry.at).getTime();
    if (!Number.isFinite(at)) continue;
    last = at;
  }
  return last;
}

function closedTiming(
  kind: OfferTimingKind,
  reason: OfferReadinessReason,
  idleSinceBrowseSec: number
): OfferTiming {
  return {
    kind,
    idleSinceBrowseSec,
    speakWindow: "closed",
    ready: false,
    reason,
  };
}

function openTiming(
  kind: Exclude<OfferTimingKind, "none">,
  reason: OfferReadinessReason,
  idleSinceBrowseSec: number
): OfferTiming {
  return {
    kind,
    idleSinceBrowseSec,
    speakWindow: "open",
    ready: true,
    reason,
  };
}

/** ADR-040 UPDS — Kad from browse sequence; primary clock = last view_product. */
export function computeOfferTiming(input: {
  sequence: BrowseSequenceEntry[];
  browse: GuestBrowseProfile;
  mental: GuestMentalModel;
  cartLineCount: number;
  nowMs: number;
}): OfferTiming {
  const lastViewMs = lastViewProductMs(input.sequence);
  const idleSinceBrowseSec =
    lastViewMs != null
      ? Math.max(0, (input.nowMs - lastViewMs) / 1000)
      : Number.POSITIVE_INFINITY;

  if (
    input.mental.predictedNeed === "needs_attention" ||
    input.mental.predictedNeed === "wants_bill" ||
    input.mental.predictedNeed === "none" ||
    input.mental.predictedNeed === "ready_to_order"
  ) {
    return closedTiming("none", "not_ready_posture", idleSinceBrowseSec);
  }

  const returnView = input.browse.viewedProducts.find(
    (product) => product.viewCount >= 2
  );
  if (returnView && idleSinceBrowseSec >= RETURN_VIEW_MIN_SEC) {
    return openTiming("return_view", "return_view", idleSinceBrowseSec);
  }

  const recentAbandon = input.browse.cartAbandoned.find((item) => {
    if (!item.removedAt) return false;
    const agoSec = (input.nowMs - new Date(item.removedAt).getTime()) / 1000;
    return (
      agoSec >= CART_HESITATION_MIN_SEC && agoSec <= CART_HESITATION_MAX_SEC
    );
  });
  if (recentAbandon && input.mental.pace === "indecisive") {
    return openTiming("cart_hesitation", "cart_hesitation", idleSinceBrowseSec);
  }

  if (input.cartLineCount > 0) {
    return closedTiming("none", "not_ready_commerce", idleSinceBrowseSec);
  }

  if (
    idleSinceBrowseSec >= BROWSE_PAUSE_MIN_SEC &&
    input.browse.viewedProducts[0]
  ) {
    return openTiming("browse_pause", "browse_pause", idleSinceBrowseSec);
  }

  if (idleSinceBrowseSec < BROWSE_PAUSE_MIN_SEC) {
    return closedTiming("none", "not_ready_idle", idleSinceBrowseSec);
  }

  return closedTiming("none", "not_ready_posture", idleSinceBrowseSec);
}

export function mapTimingToReadiness(timing: OfferTiming): {
  ready: boolean;
  reason: OfferReadinessReason;
  secondsSinceLastBrowseAction: number;
} {
  return {
    ready: timing.ready,
    reason: timing.reason,
    secondsSinceLastBrowseAction: timing.idleSinceBrowseSec,
  };
}
