import type { SessionPhase } from "@/lib/scene/types";
import type { TableTempoPhase } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";

export type ProactiveTickPayload = {
  sessionPhase?: SessionPhase;
  browseMinutes?: number;
  cartItemCount?: number;
  hasSessionOrders?: boolean;
  hasDrinkInCart?: boolean;
  /** Cart contains food/dessert lines — kitchen preorder posture. */
  hasFoodInCart?: boolean;
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
  /** Owner-defined upsell rules matched for current cart (Prompt 75). */
  adminUpsellMatches?: Array<{
    ruleId: string;
    suggestProductId: string;
    suggestProductName: string;
    message: string;
    sortOrder: number;
    dismissKey: string;
  }>;
  /** Venue daily special product name (optional). */
  todaySpecial?: string | null;
  /** Suggested dessert product name (optional). */
  dessertProductName?: string | null;
  /** K2 puzzle item for "Jeste li probali…?" nudge. */
  puzzleProductName?: string | null;
  /** K2 BCG map — dogs never recommended. */
  menuEngineeringCategories?: Record<
    string,
    import("@/lib/denis/platform/menu-engineering").MenuEngineeringCategory
  >;
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
  /** Prompt 50 — service period for period-aware welcome. */
  servicePeriod?: import("@/lib/denis/config/rhythm-prior-types").VenueServicePeriod | null;
  /** Venue-wide kitchen pending orders (floor snapshot). */
  kitchenPendingCount?: number;
  /** Estimated kitchen wait from capacity / KDS backlog. */
  kitchenEstimatedWaitMinutes?: number | null;
  /** Venue KDS stress from ops fold. */
  kdsStress?: "normal" | "high";
  /** ADR-020 venueSchedule.happyHour — bar upsell window. */
  happyHourActive?: boolean;
  /** VKG pairing for food → drink proactive (bar intelligence). */
  vkgDrinkPairing?: {
    foodName: string;
    drinkName: string;
    serveSize?: string | null;
  } | null;
  /** Latest cart abandon remove timestamp — smart recovery delay gate. */
  cartAbandonedRemovedAt?: string | null;
  /** H2 — venue-wide revenue strategy (turnover / check_size / balanced). */
  revenueStrategy?: "turnover" | "check_size" | "balanced" | null;
  /** Q1 — session experience score (0–10) for review funnel routing. */
  experienceScore?: number | null;
  googleReviewUrl?: string | null;
  lastReviewPromptAt?: string | null;
  lastReviewDismissAt?: string | null;
  paidAnchorAt?: string | null;
  billSettled?: boolean;
  /** L2 review orchestration — tip recorded this session. */
  tipRecorded?: boolean;
  waitingForBill?: boolean;
  lastGuestMessage?: string | null;
  mealStage?: string | null;
  sessionDurationMinutes?: number | null;
  recoveryCompleted?: boolean;
  postRecoveryEligible?: boolean;
  /** ADR-043 S8 — current table tempo phase from watcher/fold. */
  tableTempoPhase?: TableTempoPhase;
  /** ADR-043 S10 — dessert window accept rate for learning gate (0–1). */
  dessertWindowAcceptRate?: number | null;
  /** ADR-043 S10 — impressions for dessert nudge learning gate. */
  dessertWindowImpressions?: number;
};

export type GuestProactiveNudgeKind =
  | "waiter_gap"
  | "attention_handoff"
  | "browse_nudge"
  | "cart_recovery"
  | "cart_abandonment_prevention"
  | "drink_pairing"
  | "dessert_nudge"
  | "slow_kitchen"
  | "guest_welcome"
  | "browse_follow_up"
  | "bill_prompt"
  | "order_delay"
  | "order_eta_update"
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
  | "google_review"
  | "internal_feedback"
  | "scroll_search"
  | "scroll_category"
  | "scroll_bottom"
  | "table_tempo_browse"
  | "coffee_nudge"
  | "digestif_nudge";

export type StaffProactiveAlertKind =
  | "staff_table_idle"
  | "staff_waiter_request"
  | "staff_attention_escalation"
  | "staff_frustrated_guest"
  | "staff_allergy"
  | "staff_kitchen_delay"
  | "staff_multi_table_delay"
  | "staff_preorder_heads_up"
  | "staff_low_experience"
  | "staff_storno_suggestion"
  | "staff_drinks_finished";

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
