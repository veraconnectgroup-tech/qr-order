import type { SessionPhase } from "@/lib/scene/types";

export type ProactiveTickPayload = {
  sessionPhase?: SessionPhase;
  browseMinutes?: number;
  cartItemCount?: number;
  hasSessionOrders?: boolean;
  hasDrinkInCart?: boolean;
  dismissedNudgeKeys?: string[];
  /** Server watcher — seconds since table session opened. */
  sessionAgeSeconds?: number;
  /** Server watcher — guest chat turns in timeline. */
  guestMessageCount?: number;
  /** Minutes since last guest activity (message / order). */
  idleMinutes?: number;
  /** Guest explicitly asked for a recommendation. */
  guestAskedRecommendation?: boolean;
  /** Popularity pair from order history. */
  popularityPair?: { from: string; to: string } | null;
  /** Venue daily special product name (optional). */
  todaySpecial?: string | null;
  /** Suggested dessert product name (optional). */
  dessertProductName?: string | null;
  /** Venue display name for welcome / follow-up copy. */
  venueName?: string | null;
  /** Guest conversation language (menu / session). */
  language?: string | null;
  /** ISO timestamp of last guest "still browsing" defer. */
  browsingDeferredAt?: string | null;
  /** Count of browsing defer events in session. */
  browsingDeferCount?: number;
  /** True after proactive browse_follow_up was emitted. */
  browseFollowUpEmitted?: boolean;
  /** ISO timestamp when guest asked Denis to return (explicit). */
  followUpRequestedAt?: string | null;
  /** Guest-requested delay in seconds (e.g. "dođi za 1 minut"). */
  followUpDelaySeconds?: number | null;
  /** ADR-042 VRP-P1 — rhythm-enforced dessert delay for legacy triggers. */
  effectiveDessertDelayMinutes?: number;
  /** ADR-042 VRP-P2 — slot top product for welcome copy (enforce). */
  rhythmTopProductName?: string | null;
};

export type GuestProactiveNudgeKind =
  | "waiter_gap"
  | "attention_handoff"
  | "browse_nudge"
  | "cart_recovery"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen"
  | "guest_welcome"
  | "browse_follow_up"
  | "bill_prompt"
  | "order_delay"
  | "popularity_pair"
  | "party_incomplete";

export type StaffProactiveAlertKind =
  | "staff_table_idle"
  | "staff_waiter_request"
  | "staff_attention_escalation"
  | "staff_frustrated_guest"
  | "staff_allergy";

export type GuestProactiveNudge = {
  kind: GuestProactiveNudgeKind;
  message: string;
  orderId?: string;
  prompt?: string;
};

export type StaffProactiveAlert = {
  kind: StaffProactiveAlertKind;
  message: string;
  tableName: string;
  detail?: string;
};
