import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";

/** Policy deny reason — stable codes for timeline + enforce (ADR-038 GMM-6). */
export type ProactivePolicyReason =
  | "gmm.receptiveness_closed"
  | "gmm.nudge_budget_zero"
  | "gmm.nudge_cooldown"
  | "gmm.intent_incompatible"
  | "gmm.meal_stage_mismatch"
  | "gmm.predicted_need_mismatch"
  | "gmm.pace_rushed"
  | "gmm.pace_indecisive"
  | "gmm.engagement_welcome_skip"
  | "gmm.frustration_high"
  | "gmm.group_address_follower"
  | "gmm.needs_attention_blocks_upsell"
  | "gmm.price_affinity_mismatch"
  | "gmm.confidence_fallback";

/** @deprecated alias — use ProactivePolicyReason */
export type GmmGateReason = ProactivePolicyReason;

export type ProactivePolicyDenyCheck =
  | "party_follower"
  | "receptiveness_closed"
  | "frustration_blocks_upsell"
  | "nudge_budget_zero"
  | "nudge_cooldown"
  | "pace_rushed"
  | "pace_indecisive"
  | "welcome_requires_arrived"
  | "welcome_skip_guest_initiated"
  | "browse_requires_exploring"
  | "browse_requires_receptiveness_open"
  | "browse_requires_needs_help"
  | "popularity_requires_receptiveness_open"
  | "popularity_min_budget"
  | "dessert_requires_dessert_window"
  | "dessert_blocks_polite_decline"
  | "bill_requires_post_meal"
  | "bill_requires_wants_bill"
  | "follow_up_requires_defer"
  | "upsell_blocks_needs_attention"
  | "popularity_blocks_budget_affinity";

export type ProactiveKindPolicy = {
  upsell: boolean;
  denyChecks: readonly ProactivePolicyDenyCheck[];
};

export type ProactivePolicyManifest = {
  version: 1;
  upsellKinds: readonly GuestProactiveNudgeKind[];
  kindPolicy: Partial<Record<GuestProactiveNudgeKind, ProactiveKindPolicy>>;
  globalUpsellDenyChecks: readonly ProactivePolicyDenyCheck[];
};

export type ProactivePolicyEvaluation = {
  kind: GuestProactiveNudgeKind;
  allow: boolean;
  reason: ProactivePolicyReason | null;
};

export type ApplyProactivePolicyResult = {
  selectedKind: GuestProactiveNudgeKind | null;
  evaluations: ProactivePolicyEvaluation[];
};
