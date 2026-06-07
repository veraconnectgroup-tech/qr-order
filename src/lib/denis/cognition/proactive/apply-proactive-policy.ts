import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  DEFAULT_PROACTIVE_POLICY,
  resolveKindPolicy,
} from "@/lib/denis/cognition/proactive/proactive-policy-defaults";
import type {
  ApplyProactivePolicyResult,
  ProactivePolicyDenyCheck,
  ProactivePolicyManifest,
  ProactivePolicyReason,
} from "@/lib/denis/cognition/proactive/proactive-policy-types";
import type {
  GuestProactiveNudge,
  GuestProactiveNudgeKind,
  ProactiveTickPayload,
} from "@/lib/denis/cognition/proactive/proactive-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { RankedProactiveCandidate } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";

function receptivenessAtLeastOpen(
  receptiveness: GuestMentalModel["receptiveness"]
): boolean {
  return receptiveness === "open" || receptiveness === "enthusiastic";
}

function frustrationBlocksUpsell(
  mental: GuestMentalModel,
  threshold: ConciergeConfig["mentalModel"]["frustrationEscalateThreshold"]
): boolean {
  const level = mental.affect.frustration.level;
  if (level === "high") return true;
  if (threshold === "mild" && level === "mild") return true;
  return false;
}

const CHECK_REASON: Record<ProactivePolicyDenyCheck, ProactivePolicyReason> = {
  party_follower: "gmm.group_address_follower",
  receptiveness_closed: "gmm.receptiveness_closed",
  frustration_blocks_upsell: "gmm.frustration_high",
  nudge_budget_zero: "gmm.nudge_budget_zero",
  nudge_cooldown: "gmm.nudge_cooldown",
  pace_rushed: "gmm.pace_rushed",
  pace_indecisive: "gmm.pace_indecisive",
  welcome_requires_arrived: "gmm.intent_incompatible",
  welcome_skip_guest_initiated: "gmm.engagement_welcome_skip",
  browse_requires_exploring: "gmm.intent_incompatible",
  browse_requires_receptiveness_open: "gmm.receptiveness_closed",
  browse_requires_needs_help: "gmm.predicted_need_mismatch",
  popularity_requires_receptiveness_open: "gmm.receptiveness_closed",
  popularity_min_budget: "gmm.nudge_budget_zero",
  dessert_requires_dessert_window: "gmm.meal_stage_mismatch",
  dessert_blocks_polite_decline: "gmm.receptiveness_closed",
  bill_requires_post_meal: "gmm.meal_stage_mismatch",
  bill_requires_wants_bill: "gmm.predicted_need_mismatch",
  follow_up_requires_defer: "gmm.intent_incompatible",
  upsell_blocks_needs_attention: "gmm.needs_attention_blocks_upsell",
  popularity_blocks_budget_affinity: "gmm.price_affinity_mismatch",
  browse_requires_resolved_offer: "gmm.offer_unresolved",
  browse_readiness_not_ready: "gmm.offer_not_ready",
  cart_recovery_requires_offer: "gmm.offer_unresolved",
};

function evaluateDenyCheck(input: {
  check: ProactivePolicyDenyCheck;
  mental: GuestMentalModel;
  kind: GuestProactiveNudgeKind;
  config: ConciergeConfig;
  policy?: ProactivePolicyManifest;
  offer?: GuestOfferContext | null;
  payload?: Pick<
    ProactiveTickPayload,
    "browsingDeferredAt" | "followUpRequestedAt" | "browseFollowUpEmitted"
  >;
  now: number;
}): ProactivePolicyReason | null {
  const { mental, kind, config, payload, now } = input;

  switch (input.check) {
    case "party_follower":
      if (
        mental.groupDynamics.mode === "party" &&
        !mental.groupDynamics.addressLeader
      ) {
        return CHECK_REASON.party_follower;
      }
      return null;

    case "receptiveness_closed":
      if (mental.decline.hardClosed || mental.receptiveness === "closed") {
        return CHECK_REASON.receptiveness_closed;
      }
      return null;

    case "frustration_blocks_upsell":
      if (
        frustrationBlocksUpsell(
          mental,
          config.mentalModel.frustrationEscalateThreshold
        )
      ) {
        return CHECK_REASON.frustration_blocks_upsell;
      }
      return null;

    case "nudge_budget_zero":
      if (mental.nudgeBudget.remaining <= 0) {
        return CHECK_REASON.nudge_budget_zero;
      }
      return null;

    case "nudge_cooldown":
      if (
        mental.nudgeBudget.cooldownUntil != null &&
        now < mental.nudgeBudget.cooldownUntil
      ) {
        return CHECK_REASON.nudge_cooldown;
      }
      return null;

    case "pace_rushed":
      if (
        (kind === "browse_nudge" || kind === "popularity_pair") &&
        mental.pace === "rushed"
      ) {
        return CHECK_REASON.pace_rushed;
      }
      return null;

    case "pace_indecisive":
      if (kind === "popularity_pair" && mental.pace === "indecisive") {
        return CHECK_REASON.pace_indecisive;
      }
      return null;

    case "welcome_requires_arrived":
      if (kind === "guest_welcome" && mental.intent !== "arrived") {
        return CHECK_REASON.welcome_requires_arrived;
      }
      return null;

    case "welcome_skip_guest_initiated":
      if (kind === "guest_welcome" && mental.engagement.guestInitiated) {
        return CHECK_REASON.welcome_skip_guest_initiated;
      }
      return null;

    case "browse_requires_exploring":
      if (
        kind === "browse_nudge" &&
        mental.intent !== "exploring" &&
        mental.intent !== "comparing"
      ) {
        return CHECK_REASON.browse_requires_exploring;
      }
      return null;

    case "browse_requires_receptiveness_open":
      if (kind === "browse_nudge" && !receptivenessAtLeastOpen(mental.receptiveness)) {
        return CHECK_REASON.browse_requires_receptiveness_open;
      }
      return null;

    case "browse_requires_needs_help":
      if (
        kind === "browse_nudge" &&
        mental.predictedNeed !== "needs_help_choosing"
      ) {
        return CHECK_REASON.browse_requires_needs_help;
      }
      return null;

    case "popularity_requires_receptiveness_open":
      if (
        kind === "popularity_pair" &&
        !receptivenessAtLeastOpen(mental.receptiveness)
      ) {
        return CHECK_REASON.popularity_requires_receptiveness_open;
      }
      return null;

    case "popularity_min_budget":
      if (kind === "popularity_pair" && mental.nudgeBudget.remaining < 1) {
        return CHECK_REASON.popularity_min_budget;
      }
      return null;

    case "dessert_requires_dessert_window":
      if (kind === "dessert_nudge" && mental.mealStage !== "dessert_window") {
        return CHECK_REASON.dessert_requires_dessert_window;
      }
      return null;

    case "dessert_blocks_polite_decline":
      if (kind === "dessert_nudge" && mental.receptiveness === "polite_decline") {
        return CHECK_REASON.dessert_blocks_polite_decline;
      }
      return null;

    case "bill_requires_post_meal":
      if (
        kind === "bill_prompt" &&
        mental.mealStage !== "post_meal" &&
        mental.mealStage !== "paying"
      ) {
        return CHECK_REASON.bill_requires_post_meal;
      }
      return null;

    case "bill_requires_wants_bill":
      if (kind === "bill_prompt" && mental.predictedNeed !== "wants_bill") {
        return CHECK_REASON.bill_requires_wants_bill;
      }
      return null;

    case "follow_up_requires_defer": {
      if (kind !== "browse_follow_up") return null;
      const deferred = Boolean(payload?.browsingDeferredAt);
      const requested = Boolean(payload?.followUpRequestedAt);
      if (!deferred && !requested) {
        return CHECK_REASON.follow_up_requires_defer;
      }
      if (payload?.browseFollowUpEmitted) {
        return CHECK_REASON.follow_up_requires_defer;
      }
      return null;
    }

    case "upsell_blocks_needs_attention": {
      const policy = input.policy ?? DEFAULT_PROACTIVE_POLICY;
      if (!resolveKindPolicy(policy, kind).upsell) return null;
      if (mental.predictedNeed === "needs_attention") {
        return CHECK_REASON.upsell_blocks_needs_attention;
      }
      return null;
    }

    case "popularity_blocks_budget_affinity":
      if (kind === "popularity_pair" && mental.priceAffinity === "budget") {
        return CHECK_REASON.popularity_blocks_budget_affinity;
      }
      return null;

    case "browse_requires_resolved_offer":
      if (!input.config.proactive.offerEnrich) return null;
      if (kind !== "browse_nudge" && kind !== "cart_recovery") return null;
      if (!input.offer?.primary) {
        return CHECK_REASON.browse_requires_resolved_offer;
      }
      return null;

    case "browse_readiness_not_ready":
      if (!input.config.proactive.offerEnrich) return null;
      if (kind !== "browse_nudge") return null;
      if (!input.offer?.readiness.ready) {
        return CHECK_REASON.browse_readiness_not_ready;
      }
      return null;

    case "cart_recovery_requires_offer":
      if (!input.config.proactive.offerEnrich) return null;
      if (kind !== "cart_recovery") return null;
      if (!input.offer?.cartRecovery) {
        return CHECK_REASON.cart_recovery_requires_offer;
      }
      return null;

    default:
      return null;
  }
}

export function evaluateProactivePolicyForKind(input: {
  mental: GuestMentalModel;
  kind: GuestProactiveNudgeKind;
  config: ConciergeConfig;
  policy?: ProactivePolicyManifest;
  offer?: GuestOfferContext | null;
  payload?: Pick<
    ProactiveTickPayload,
    "browsingDeferredAt" | "followUpRequestedAt" | "browseFollowUpEmitted"
  >;
  now?: number;
}): { allow: boolean; reason: ProactivePolicyReason | null } {
  const policy = input.policy ?? DEFAULT_PROACTIVE_POLICY;
  const now = input.now ?? Date.now();
  const kindPolicy = resolveKindPolicy(policy, input.kind);

  for (const check of kindPolicy.denyChecks) {
    const reason = evaluateDenyCheck({
      check,
      mental: input.mental,
      kind: input.kind,
      config: input.config,
      policy: input.policy,
      offer: input.offer,
      payload: input.payload,
      now,
    });
    if (reason) {
      return { allow: false, reason };
    }
  }

  return { allow: true, reason: null };
}

/** Walk ranked candidates — first passing policy wins (ADR-038 GMM-6). */
export function applyProactivePolicy(input: {
  mental: GuestMentalModel;
  ranked: RankedProactiveCandidate[];
  config: ConciergeConfig;
  policy?: ProactivePolicyManifest;
  offer?: GuestOfferContext | null;
  payload?: Pick<
    ProactiveTickPayload,
    "browsingDeferredAt" | "followUpRequestedAt" | "browseFollowUpEmitted"
  >;
  now?: number;
}): ApplyProactivePolicyResult {
  const evaluations: ApplyProactivePolicyResult["evaluations"] = [];

  for (const row of input.ranked) {
    const verdict = evaluateProactivePolicyForKind({
      mental: input.mental,
      kind: row.nudge.kind,
      config: input.config,
      policy: input.policy,
      offer: input.offer,
      payload: input.payload,
      now: input.now,
    });

    evaluations.push({
      kind: row.nudge.kind,
      allow: verdict.allow,
      reason: verdict.reason,
    });

    if (verdict.allow) {
      return { selectedKind: row.nudge.kind, evaluations };
    }
  }

  return { selectedKind: null, evaluations };
}

/** Legacy single-candidate gate API — delegates to policy manifest. */
export function gateProactiveNudge(input: {
  mental: GuestMentalModel;
  candidate: GuestProactiveNudge;
  config: ConciergeConfig;
  offer?: GuestOfferContext | null;
  payload?: Pick<
    ProactiveTickPayload,
    "browsingDeferredAt" | "followUpRequestedAt" | "browseFollowUpEmitted"
  >;
  now?: number;
}): {
  allow: boolean;
  reason: ProactivePolicyReason | null;
  wouldBlock: boolean;
} {
  const verdict = evaluateProactivePolicyForKind({
    mental: input.mental,
    kind: input.candidate.kind,
    config: input.config,
    offer: input.offer,
    payload: input.payload,
    now: input.now,
  });

  return {
    allow: verdict.allow,
    reason: verdict.reason,
    wouldBlock: !verdict.allow,
  };
}

export type { ProactivePolicyReason as GmmGateReason };
