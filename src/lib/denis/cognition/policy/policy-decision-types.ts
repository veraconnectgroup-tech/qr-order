/**
 * Guest Conduct Policy Engine — types.
 *
 * MVP-1 scope (Architecture Proposal §16 step 1): driven only by the
 * resurrected `abuse-protection.ts` regex layer (`offensive_content`
 * signal), no LLM assessment yet. Fires only for rudeness/insults directed
 * at Denis himself — NOT for service frustration (wait times etc.), which
 * the existing `frustration-recovery.ts` pipeline already owns. This split
 * is a founder decision, not a technical default.
 */
export type ConductTier = "none" | "warn_1" | "warn_2" | "handoff";

export const CONDUCT_TIER_ORDER: readonly ConductTier[] = [
  "none",
  "warn_1",
  "warn_2",
  "handoff",
] as const;

export type GuestConductTracker = {
  aiSessionId: string;
  tier: ConductTier;
  /** Cumulative offenses (rudeness directed at Denis) this session — monotonic, never decremented. */
  totalOffenseCount: number;
  /** Consecutive respectful turns since the last offense — the only path back down a tier. */
  respectfulStreak: number;
  tierSince: number;
};

export type PolicyDecision = {
  tier: ConductTier;
  /** Set only on the turn a tier is freshly reached — never repeated on subsequent calm turns. */
  guestMessageOverride: string | null;
  haltSensitiveActions: boolean;
  notifyStaff: boolean;
  auditReason: string;
};

export type GuestConductLadderConfig = {
  /** Offense count at which warn_1 fires. */
  warnAfterInsults: number;
  /** Offense count at which the session is handed off to a colleague. */
  handoffAfterInsults: number;
  /** Consecutive respectful turns required to step back down one tier. */
  respectfulTurnsToDeescalate: number;
};

export const DEFAULT_GUEST_CONDUCT_LADDER_CONFIG: GuestConductLadderConfig = {
  warnAfterInsults: 1,
  handoffAfterInsults: 3,
  respectfulTurnsToDeescalate: 3,
};

export function emptyGuestConductTracker(
  aiSessionId: string,
  now = Date.now()
): GuestConductTracker {
  return {
    aiSessionId,
    tier: "none",
    totalOffenseCount: 0,
    respectfulStreak: 0,
    tierSince: now,
  };
}
