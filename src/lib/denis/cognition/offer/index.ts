export type {
  BrowseSequenceEntry,
  BrowseSequencePattern,
  FoldGuestOfferContextInput,
  GuestOfferContext,
  OfferReadiness,
  OfferReadinessReason,
  OfferTiming,
  OfferTimingKind,
  OfferResolutionKind,
  OfferResolutionTrace,
  ResolvedOffer,
  ScoredBrowseProduct,
} from "@/lib/denis/cognition/offer/offer-types";
export { GUEST_OFFER_CONTEXT_VERSION } from "@/lib/denis/cognition/offer/offer-types";
export { foldGuestOfferContext } from "@/lib/denis/cognition/offer/fold-guest-offer-context";
export { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
export { foldBrowseSequence } from "@/lib/denis/cognition/offer/fold-browse-sequence";
export { detectBrowseSequencePattern } from "@/lib/denis/cognition/offer/detect-browse-sequence-pattern";
export { scoreBrowseProducts } from "@/lib/denis/cognition/offer/score-browse-products";
export { deriveOfferReadiness } from "@/lib/denis/cognition/offer/derive-offer-readiness";
export {
  computeOfferTiming,
  mapTimingToReadiness,
  BROWSE_PAUSE_MIN_SEC,
} from "@/lib/denis/cognition/offer/compute-offer-timing";
export {
  browsePauseOpenBeyondLegacyCap,
  timingUsesBrowseClock,
  violatesNeedsHelpTimingBlock,
} from "@/lib/denis/cognition/offer/offer-timing-invariants";
export { resolveOfferForPosture } from "@/lib/denis/cognition/offer/resolve-offer-for-posture";
export { narrateOfferFromBeliefs } from "@/lib/denis/cognition/offer/narrate-offer-from-beliefs";
export { narrateOffer, narrateCartRecoveryOffer } from "@/lib/denis/cognition/offer/narrate-offer";
export { maybeAppendOfferConverted } from "@/lib/denis/cognition/offer/append-offer-converted";
export { maybeAppendNudgeOutcomes } from "@/lib/denis/cognition/offer/append-nudge-outcome";
export { maybeAppendOfferResolved } from "@/lib/denis/cognition/offer/append-offer-event";
export { buildProactiveEmittedPayload } from "@/lib/denis/cognition/offer/build-proactive-emitted-payload";
export { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
export { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
export {
  foldNudgeRevenueAttribution,
  sumAttributedNudgeRevenueCents,
} from "@/lib/denis/cognition/offer/fold-nudge-revenue";
export { foldProductNudgeStats } from "@/lib/denis/cognition/offer/fold-product-nudge-stats";
export { resolveProactiveOfferProduct } from "@/lib/denis/cognition/offer/resolve-proactive-offer-product";
export {
  NUDGE_ACCEPT_WINDOW_SEC,
  NUDGE_RESOLVE_WINDOW_SEC,
  nudgeOutcomeDedupeKey,
} from "@/lib/denis/cognition/offer/nudge-outcome-types";
export type {
  NudgeOutcomeKind,
  NudgeOutcomeRecord,
  PendingNudge,
} from "@/lib/denis/cognition/offer/nudge-outcome-types";
export {
  OFFER_CONVERSION_WINDOW_SEC,
  offerConversionDedupeKey,
} from "@/lib/denis/cognition/offer/offer-conversion-types";
