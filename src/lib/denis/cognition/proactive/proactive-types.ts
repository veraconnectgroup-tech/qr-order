export type ProactiveTickPayload = {
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
};

export type GuestProactiveNudgeKind =
  | "browse_nudge"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen"
  | "guest_welcome"
  | "bill_prompt"
  | "order_delay"
  | "popularity_pair";

export type StaffProactiveAlertKind =
  | "staff_table_idle"
  | "staff_waiter_request"
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
