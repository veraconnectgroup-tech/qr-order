import type {
  ProactiveKindPolicy,
  ProactivePolicyManifest,
} from "@/lib/denis/cognition/proactive/proactive-policy-types";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";

const GLOBAL_UPSELL_DENY = [
  "party_follower",
  "receptiveness_closed",
  "frustration_blocks_upsell",
  "upsell_blocks_needs_attention",
  "nudge_budget_zero",
  "nudge_cooldown",
] as const;

const upsell = (
  denyChecks: ProactiveKindPolicy["denyChecks"]
): ProactiveKindPolicy => ({
  upsell: true,
  denyChecks: [...GLOBAL_UPSELL_DENY, ...denyChecks],
});

const service = (): ProactiveKindPolicy => ({
  upsell: false,
  denyChecks: ["party_follower"],
});

/** Canonical proactive posture policy — single manifest (ADR-038 GMM-6). */
export const PROACTIVE_POLICY_VERSION = "gmm-v1" as const;

export const DEFAULT_PROACTIVE_POLICY: ProactivePolicyManifest = {
  version: 1,
  upsellKinds: [
    "guest_welcome",
    "browse_nudge",
    "cart_recovery",
    "popularity_pair",
    "dessert_nudge",
    "bill_prompt",
    "browse_follow_up",
  ],
  globalUpsellDenyChecks: GLOBAL_UPSELL_DENY,
  kindPolicy: {
    guest_welcome: upsell([
      "welcome_requires_arrived",
      "welcome_skip_guest_initiated",
    ]),
    browse_follow_up: upsell(["follow_up_requires_defer"]),
    browse_nudge: upsell([
      "pace_rushed",
      "browse_requires_exploring",
      "browse_requires_receptiveness_open",
      "browse_requires_needs_help",
      "browse_requires_resolved_offer",
      "browse_readiness_not_ready",
    ]),
    cart_recovery: upsell([
      "pace_rushed",
      "browse_requires_receptiveness_open",
      "cart_recovery_requires_offer",
    ]),
    popularity_pair: upsell([
      "pace_rushed",
      "pace_indecisive",
      "popularity_requires_receptiveness_open",
      "popularity_min_budget",
      "popularity_blocks_budget_affinity",
    ]),
    dessert_nudge: upsell([
      "dessert_requires_dessert_window",
      "dessert_blocks_polite_decline",
    ]),
    bill_prompt: upsell([
      "bill_requires_post_meal",
      "bill_requires_wants_bill",
    ]),
    slow_kitchen: service(),
    order_delay: service(),
    drink_pairing: service(),
    waiter_gap: service(),
    attention_handoff: service(),
  },
};

export function resolveKindPolicy(
  policy: ProactivePolicyManifest,
  kind: GuestProactiveNudgeKind
): ProactiveKindPolicy {
  return (
    policy.kindPolicy[kind] ?? {
      upsell: policy.upsellKinds.includes(kind),
      denyChecks: policy.upsellKinds.includes(kind)
        ? policy.globalUpsellDenyChecks
        : ["party_follower"],
    }
  );
}
