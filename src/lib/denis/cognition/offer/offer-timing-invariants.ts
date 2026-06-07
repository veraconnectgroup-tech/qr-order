import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { OfferTiming } from "@/lib/denis/cognition/offer/offer-types";

/** T1 — needs_help alone must not veto readiness via posture_ready. */
export function violatesNeedsHelpTimingBlock(
  timing: OfferTiming,
  mental: GuestMentalModel
): boolean {
  return (
    mental.predictedNeed === "needs_help_choosing" &&
    timing.reason === "posture_ready" &&
    !timing.ready
  );
}

/** T2 — browse_pause requires view-based idle (finite seconds, not chat-only spine). */
export function timingUsesBrowseClock(timing: OfferTiming): boolean {
  if (timing.kind !== "browse_pause" && timing.reason !== "browse_pause") {
    return true;
  }
  return Number.isFinite(timing.idleSinceBrowseSec);
}

/** T3 — no hard upper idle cap: browse_pause stays open beyond legacy 20s window. */
export function browsePauseOpenBeyondLegacyCap(
  timing: OfferTiming,
  idleSec: number
): boolean {
  return (
    timing.kind === "browse_pause" &&
    timing.ready &&
    idleSec > 20
  );
}
