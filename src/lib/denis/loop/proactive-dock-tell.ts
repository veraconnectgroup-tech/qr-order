import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { SceneMarkState } from "@/lib/scene/types";

export type ProactiveNudgeKind =
  | "browse_nudge"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen";

const PROACTIVE_DOCK_KINDS: ProactiveNudgeKind[] = [
  "slow_kitchen",
  "dessert_nudge",
];

/** Proactive nudges that appear in dock headline + chat transcript (not dismiss banner only). */
export function shouldCommitProactiveToDock(kind: ProactiveNudgeKind): boolean {
  return PROACTIVE_DOCK_KINDS.includes(kind);
}

export function proactiveDockMarkState(kind: ProactiveNudgeKind): SceneMarkState {
  if (kind === "slow_kitchen") return "think";
  return "idle";
}

function proactiveDedupeKey(input: {
  kind: ProactiveNudgeKind;
  orderId?: string;
}): string {
  return input.orderId ? `${input.kind}:${input.orderId}` : input.kind;
}

/** Skip duplicate dock tells — dismissed keys or same text already in transcript. */
export function isProactiveDockDuplicate(
  state: TableSessionState,
  input: { kind: ProactiveNudgeKind; orderId?: string },
  message: string
): boolean {
  const key = proactiveDedupeKey(input);
  const dismissed = state.conversation.dismissedNudges;
  if (dismissed.includes(key) || dismissed.includes(input.kind)) {
    return true;
  }

  const trimmed = message.trim();
  if (!trimmed) return true;

  const transcript = foldTranscriptFromTimeline(state.timeline);
  return transcript.some(
    (entry) => entry.role === "denis" && entry.text.trim() === trimmed
  );
}
