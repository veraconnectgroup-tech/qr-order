import type { NudgeOutcomeKind } from "@/lib/denis/cognition/offer/nudge-outcome-types";

export type SessionNudgeFatigueLevel = "none" | "cooling" | "exhausted";

export type PreventionFatigueState = {
  blocked: boolean;
  reason:
    | "max_attempts"
    | "guest_ignored"
    | "duplicate_kind"
    | "respect_decline"
    | null;
};

export const MAX_PREVENTION_ATTEMPTS_PER_SESSION = 1;

/** Guest ignored a prevention nudge — stop further attempts. */
export function hasPreventionGuestIgnored(
  outcomes: NudgeOutcomeKind[]
): boolean {
  return outcomes.slice(-3).some((outcome) => outcome === "ignored");
}

/** No-annoy guarantee for cart abandonment prevention (12→2). */
export function derivePreventionFatigue(input: {
  preventionEmitCount: number;
  preventionIgnored: boolean;
  usedInterventionKinds: string[];
  nextKind: string | null;
  respectDecline: boolean;
  nudgeOutcomes: NudgeOutcomeKind[];
}): PreventionFatigueState {
  if (input.respectDecline && hasPreventionGuestIgnored(input.nudgeOutcomes)) {
    return { blocked: true, reason: "guest_ignored" };
  }

  if (input.preventionIgnored) {
    return { blocked: true, reason: "guest_ignored" };
  }

  if (input.preventionEmitCount >= MAX_PREVENTION_ATTEMPTS_PER_SESSION) {
    return { blocked: true, reason: "max_attempts" };
  }

  if (
    input.nextKind &&
    input.usedInterventionKinds.includes(input.nextKind)
  ) {
    return { blocked: true, reason: "duplicate_kind" };
  }

  const recentDeclines = input.nudgeOutcomes
    .slice(-2)
    .filter((outcome) => outcome === "declined" || outcome === "ignored");
  if (input.respectDecline && recentDeclines.length >= 2) {
    return { blocked: true, reason: "respect_decline" };
  }

  return { blocked: false, reason: null };
}

/** Session-scoped nudge saturation from resolved outcome sequence (ADR-039). */
export function deriveSessionNudgeFatigue(
  outcomes: NudgeOutcomeKind[]
): SessionNudgeFatigueLevel {
  if (outcomes.length === 0) return "none";

  const tail3 = outcomes.slice(-3);
  if (
    tail3.length === 3 &&
    tail3[0] === "accepted" &&
    tail3[1] === "declined" &&
    tail3[2] === "declined"
  ) {
    return "exhausted";
  }

  const tail2 = outcomes.slice(-2);
  if (
    tail2.length === 2 &&
    tail2.every((outcome) => outcome === "declined" || outcome === "ignored")
  ) {
    return "exhausted";
  }

  if (outcomes.length >= 3) {
    const accepted = outcomes.filter((outcome) => outcome === "accepted").length;
    if (accepted / outcomes.length < 0.25) return "cooling";
  }

  return "none";
}
