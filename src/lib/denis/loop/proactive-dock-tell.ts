import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { SceneMarkState } from "@/lib/scene/types";

export type ProactiveNudgeKind =
  | "waiter_gap"
  | "attention_handoff"
  | "browse_nudge"
  | "cart_recovery"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen"
  | "guest_welcome"
  | "browse_follow_up"
  | "table_tempo_browse"
  | "bill_prompt"
  | "order_delay"
  | "order_eta_update"
  | "order_preparing_notify"
  | "order_ready"
  | "order_ready_notify"
  | "kitchen_busy"
  | "kitchen_busy_preorder"
  | "cooking_grill_started"
  | "cooking_plating"
  | "station_bottleneck_avoid"
  | "drink_refill"
  | "drink_with_food"
  | "sommelier_pairing"
  | "sommelier_refill"
  | "party_drink_gap"
  | "round_two"
  | "happy_hour_upsell"
  | "popularity_pair"
  | "party_incomplete"
  | "cart_abandonment_prevention"
  | "google_review"
  | "internal_feedback"
  | "scroll_search"
  | "scroll_category"
  | "scroll_bottom"
  | "coffee_nudge"
  | "digestif_nudge";

const PROACTIVE_DOCK_KINDS: ProactiveNudgeKind[] = [
  "waiter_gap",
  "attention_handoff",
  "guest_welcome",
  "browse_follow_up",
  "table_tempo_browse",
  "order_ready_notify",
  "order_ready",
  "cooking_plating",
  "cooking_grill_started",
  "slow_kitchen",
  "order_eta_update",
  "order_delay",
  "dessert_nudge",
  "coffee_nudge",
  "digestif_nudge",
  "bill_prompt",
  "popularity_pair",
];

/** Proactive nudges that appear in dock headline + chat transcript (not dismiss banner only). */
export function shouldCommitProactiveToDock(kind: ProactiveNudgeKind): boolean {
  return PROACTIVE_DOCK_KINDS.includes(kind);
}

export function proactiveDockMarkState(kind: ProactiveNudgeKind): SceneMarkState {
  if (
    kind === "waiter_gap" ||
    kind === "attention_handoff" ||
    kind === "order_ready_notify" ||
    kind === "order_ready" ||
    kind === "cooking_plating" ||
    kind === "cooking_grill_started" ||
    kind === "slow_kitchen" ||
    kind === "order_eta_update" ||
    kind === "order_delay"
  ) {
    return "think";
  }
  if (kind === "bill_prompt") return "listen";
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
