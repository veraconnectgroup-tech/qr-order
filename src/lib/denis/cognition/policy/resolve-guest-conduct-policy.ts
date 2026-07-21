import { stepGuestConductTier } from "@/lib/denis/cognition/policy/guest-conduct-ladder";
import {
  DEFAULT_GUEST_CONDUCT_LADDER_CONFIG,
  type ConductTier,
  type GuestConductLadderConfig,
  type GuestConductTracker,
  type PolicyDecision,
} from "@/lib/denis/cognition/policy/policy-decision-types";

/**
 * Exported (not just module-private) so the de-escalation tone eval
 * (src/lib/denis/eval/run-deescalation-tone-eval.ts) can judge the exact
 * production string guests receive, instead of a hand-copied duplicate
 * that could silently drift from what's actually shipped.
 */
export const WARN_1_MESSAGE = "Molim vas, ostanimo pristojni jedno prema drugom.";
export const WARN_2_MESSAGE =
  "Već sam vas zamolio da budemo pristojni — ako se ovo ponovi, zvaću kolegu da preuzme razgovor.";
export const HANDOFF_MESSAGE = "Zvaću kolegu da nastavi umesto mene.";

function buildPolicyDecision(
  tier: ConductTier,
  offenseDetectedThisTurn: boolean
): PolicyDecision {
  switch (tier) {
    case "warn_1":
      return {
        tier,
        guestMessageOverride: offenseDetectedThisTurn ? WARN_1_MESSAGE : null,
        haltSensitiveActions: false,
        notifyStaff: false,
        auditReason: "first rudeness directed at Denis this session",
      };
    case "warn_2":
      return {
        tier,
        guestMessageOverride: offenseDetectedThisTurn ? WARN_2_MESSAGE : null,
        haltSensitiveActions: false,
        notifyStaff: false,
        auditReason: "repeated rudeness directed at Denis this session",
      };
    case "handoff":
      return {
        tier,
        guestMessageOverride: offenseDetectedThisTurn ? HANDOFF_MESSAGE : null,
        haltSensitiveActions: true,
        notifyStaff: true,
        auditReason: "guest conduct ladder reached handoff threshold",
      };
    default:
      return {
        tier: "none",
        guestMessageOverride: null,
        haltSensitiveActions: false,
        notifyStaff: false,
        auditReason: "no conduct concern",
      };
  }
}

/**
 * MVP-1: `offenseDetectedThisTurn` must come only from abuse-protection.ts's
 * `offensive_content` signal (heavy profanity/insults) — never from
 * `rate_exceeded`/`prompt_injection`/etc, which are security concerns
 * abuse-protection.ts already handles on its own, and never from service
 * frustration, which `frustration-recovery.ts` already owns. Mixing those
 * in here would fire this ladder for the wrong reason.
 */
export function resolveGuestConductPolicy(input: {
  offenseDetectedThisTurn: boolean;
  tracker: GuestConductTracker;
  config?: GuestConductLadderConfig;
  now?: number;
}): { decision: PolicyDecision; tracker: GuestConductTracker } {
  const config = input.config ?? DEFAULT_GUEST_CONDUCT_LADDER_CONFIG;
  const now = input.now ?? Date.now();

  const totalOffenseCount = input.offenseDetectedThisTurn
    ? input.tracker.totalOffenseCount + 1
    : input.tracker.totalOffenseCount;

  const respectfulStreak = input.offenseDetectedThisTurn
    ? 0
    : input.tracker.respectfulStreak + 1;

  const nextTier = stepGuestConductTier({
    currentTier: input.tracker.tier,
    offenseDetectedThisTurn: input.offenseDetectedThisTurn,
    respectfulStreak,
    totalOffenseCount,
    config,
  });

  const nextTracker: GuestConductTracker = {
    ...input.tracker,
    tier: nextTier,
    totalOffenseCount,
    respectfulStreak,
    tierSince: nextTier !== input.tracker.tier ? now : input.tracker.tierSince,
  };

  const decision = buildPolicyDecision(nextTier, input.offenseDetectedThisTurn);

  return { decision, tracker: nextTracker };
}
