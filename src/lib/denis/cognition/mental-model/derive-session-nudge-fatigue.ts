import type { NudgeOutcomeKind } from "@/lib/denis/cognition/offer/nudge-outcome-types";

export type SessionNudgeFatigueLevel = "none" | "cooling" | "exhausted";

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
