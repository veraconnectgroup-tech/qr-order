/**
 * How much this specific, still-open conversation should shade Denis's
 * patience — not a permanent per-person score (stations have no staff
 * login, so "who did this" is unknowable and deliberately not tracked).
 * Denis's own sense that his time and attention aren't free: being
 * stonewalled, dismissed, or cut off mid-question within THIS exchange
 * should register — mildly, always professionally — for the rest of that
 * exchange only. Discarded once the question resolves or expires.
 */

const TURNS_CONSUMED_CAP = 4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function resolveConversationRespectSignal(input: {
  /** A staff reply in this conversation was classified as dismissive/curt. */
  dismissiveTranscriptSeen: boolean;
  /** Retry turns spent re-asking the same thing without an answer. */
  turnsConsumed: number;
  /** The active question changed (conversation cut off) before resolving. */
  wasAbandoned: boolean;
}): number {
  const stonewallPressure = clamp01(input.turnsConsumed / TURNS_CONSUMED_CAP);
  const dismissivePressure = input.dismissiveTranscriptSeen ? 1 : 0;
  const abandonedPressure = input.wasAbandoned ? 0.6 : 0;

  // Whichever signal is worse — a flatly dismissive reply matters even on
  // the first turn, a long stonewall matters even without one rude line.
  return Math.max(stonewallPressure, dismissivePressure, abandonedPressure);
}
