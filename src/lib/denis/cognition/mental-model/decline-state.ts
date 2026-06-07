import type { GuestSignalSpine } from "@/lib/denis/cognition/mental-model/guest-signal-types";

/** Unified decline fold — single source for receptiveness + nudge budget (ADR-038 Val A). */
export type DeclineState = {
  dismissedCount: number;
  explicitCount: number;
  hardClosed: boolean;
  lastDeclineAt: number | null;
};

export function deriveDeclineState(input: {
  spine: GuestSignalSpine;
  dismissedNudgeKeys: string[];
}): DeclineState {
  const explicitCount = input.spine.declineSignals.filter(
    (signal) => signal.kind === "explicit"
  ).length;

  const dismissedKeys = new Set<string>(input.dismissedNudgeKeys);
  for (const signal of input.spine.declineSignals) {
    if (signal.kind === "dismiss" && signal.nudgeKey) {
      dismissedKeys.add(signal.nudgeKey);
    }
  }

  const dismissedCount = dismissedKeys.size;
  const declineMoments = input.spine.declineSignals.map((signal) => signal.at).sort((a, b) => a - b);
  const lastDeclineAt =
    declineMoments.length > 0 ? (declineMoments[declineMoments.length - 1] ?? null) : null;

  const hardClosed = dismissedCount >= 2 && explicitCount >= 1;

  return {
    dismissedCount,
    explicitCount,
    hardClosed,
    lastDeclineAt,
  };
}
