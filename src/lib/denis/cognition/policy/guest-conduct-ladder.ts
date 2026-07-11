import {
  CONDUCT_TIER_ORDER,
  DEFAULT_GUEST_CONDUCT_LADDER_CONFIG,
  type ConductTier,
  type GuestConductLadderConfig,
} from "@/lib/denis/cognition/policy/policy-decision-types";

/**
 * One ladder step — asymmetric on purpose (Architecture Proposal §15.2):
 * a single offense steps up immediately, but stepping back down needs
 * several consecutive respectful turns. Handoff is a one-way door for the
 * rest of this session — a colleague clears it, not automatic decay.
 */
export function stepGuestConductTier(input: {
  currentTier: ConductTier;
  offenseDetectedThisTurn: boolean;
  respectfulStreak: number;
  totalOffenseCount: number;
  config?: GuestConductLadderConfig;
}): ConductTier {
  const config = input.config ?? DEFAULT_GUEST_CONDUCT_LADDER_CONFIG;

  if (input.offenseDetectedThisTurn) {
    if (input.totalOffenseCount >= config.handoffAfterInsults) return "handoff";
    if (input.totalOffenseCount >= config.warnAfterInsults + 1) return "warn_2";
    if (input.totalOffenseCount >= config.warnAfterInsults) return "warn_1";
    return input.currentTier;
  }

  if (input.currentTier === "handoff" || input.currentTier === "none") {
    return input.currentTier;
  }

  if (input.respectfulStreak >= config.respectfulTurnsToDeescalate) {
    const idx = CONDUCT_TIER_ORDER.indexOf(input.currentTier);
    return CONDUCT_TIER_ORDER[Math.max(0, idx - 1)]!;
  }

  return input.currentTier;
}
