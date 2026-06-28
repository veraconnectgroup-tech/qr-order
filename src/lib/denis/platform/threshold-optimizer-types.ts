import type { NudgeOutcomeKind } from "@/lib/denis/platform/nudge-outcome-types";

export type ThresholdNudgeOutcome = {
  nudgeKind: string;
  outcome: NudgeOutcomeKind;
  timingMinutes: number;
};
