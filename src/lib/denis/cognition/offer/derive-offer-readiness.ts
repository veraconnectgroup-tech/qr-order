import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  computeOfferTiming,
  mapTimingToReadiness,
} from "@/lib/denis/cognition/offer/compute-offer-timing";
import type {
  BrowseSequenceEntry,
  OfferReadiness,
} from "@/lib/denis/cognition/offer/offer-types";

/** Adapter — readiness projection from UPDS timing (ADR-040). */
export function deriveOfferReadiness(input: {
  sequence: BrowseSequenceEntry[];
  browse: GuestBrowseProfile;
  mental: GuestMentalModel;
  cartLineCount: number;
  nowMs: number;
}): OfferReadiness {
  const timing = computeOfferTiming(input);
  return mapTimingToReadiness(timing);
}
