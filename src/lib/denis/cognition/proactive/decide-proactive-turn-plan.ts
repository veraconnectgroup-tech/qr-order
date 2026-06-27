import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
  type TurnPlan,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import type { SessionPhase } from "@/lib/scene/types";

export type DecideProactiveTurnPlanInput = {
  beliefs: BeliefGraph;
  candidate: GuestProactiveNudge;
  sessionPhase: SessionPhase;
  config: ConciergeConfig;
  /** Open cart draft lines block proactive; submitted kitchen orders do not. */
  cartLineCount?: number;
};

export type ProactiveTurnPlanResult =
  | { ok: true; plan: TurnPlan; templateKey: string }
  | { ok: false; reason: string };

const UPSELL_NUDGE_KINDS: GuestProactiveNudge["kind"][] = [
  "drink_pairing",
  "dessert_nudge",
  "popularity_pair",
];

function templateKeyForKind(kind: GuestProactiveNudge["kind"]): string {
  switch (kind) {
    case "waiter_gap":
      return "waiter.gap_clarify.generic";
    case "attention_handoff":
      return "proactive.attention_handoff";
    case "browse_nudge":
      return "proactive.browse";
    case "cart_recovery":
      return "proactive.cart_recovery";
    case "drink_pairing":
      return "proactive.drink_pairing";
    case "dessert_nudge":
      return "proactive.dessert";
    case "slow_kitchen":
      return "proactive.slow_kitchen";
    case "guest_welcome":
      return "proactive.guest_welcome";
    case "browse_follow_up":
      return "proactive.browse_follow_up";
    case "bill_prompt":
      return "proactive.bill_prompt";
    case "order_delay":
      return "proactive.order_delay";
    case "popularity_pair":
      return "proactive.popularity_pair";
    case "party_incomplete":
      return "proactive.party_incomplete";
  }
}

function commerceBlocksProactive(
  beliefs: BeliefGraph,
  cartLineCount: number
): boolean {
  const awaiting = getBeliefValue<string | null>(
    beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const pendingSlot = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  const pressure = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );

  return (
    awaiting != null ||
    Boolean(pendingSlot) ||
    pressure === "confirm" ||
    cartLineCount > 0
  );
}

function venueOpsSuppressUpsell(beliefs: BeliefGraph): boolean {
  return (
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell) === true ||
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueRush) === true
  );
}

function upsellSuppressedLegacy(beliefs: BeliefGraph): boolean {
  if (venueOpsSuppressUpsell(beliefs)) return true;

  const receptiveness = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.mentalReceptiveness
  );
  if (receptiveness === "closed" || receptiveness === "polite_decline") {
    return true;
  }

  const predictedNeed = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.mentalPredictedNeed
  );
  if (predictedNeed === "needs_attention") return true;

  const frustration = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.mentalFrustration
  );
  return frustration === "high";
}

/**
 * ADR-023 D-PRO — proactive nudge routing through TDE beliefs (phase guards).
 */
export function decideProactiveTurnPlan(
  input: DecideProactiveTurnPlanInput
): ProactiveTurnPlanResult {
  const { beliefs, candidate, sessionPhase, config } = input;

  if (!config.proactive.enabled && candidate.kind !== "waiter_gap" && candidate.kind !== "attention_handoff") {
    return { ok: false, reason: "proactive.disabled" };
  }

  if (
    candidate.kind !== "waiter_gap" &&
    candidate.kind !== "attention_handoff" &&
    commerceBlocksProactive(beliefs, input.cartLineCount ?? 0)
  ) {
    return { ok: false, reason: "commerce.active" };
  }

  const mode = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (sessionPhase === "closed") {
    return { ok: false, reason: "session.closed" };
  }

  if (
    (mode === "settling" || sessionPhase === "settling") &&
    candidate.kind !== "dessert_nudge" &&
    candidate.kind !== "bill_prompt"
  ) {
    return { ok: false, reason: "session.settling" };
  }

  const enforceMode = resolveMentalModelMode(config) === "enforce";

  if (UPSELL_NUDGE_KINDS.includes(candidate.kind)) {
    const suppressed = enforceMode
      ? venueOpsSuppressUpsell(beliefs)
      : upsellSuppressedLegacy(beliefs);
    if (suppressed) {
      return { ok: false, reason: "venue.upsell_suppressed" };
    }
  }

  // D-NUDGE — no dessert while kitchen still has open mains (waiting/rush).
  if (candidate.kind === "dessert_nudge" && sessionPhase === "waiting") {
    return { ok: false, reason: "phase.dessert_blocked" };
  }

  if (
    (candidate.kind === "browse_nudge" || candidate.kind === "cart_recovery") &&
    sessionPhase !== "browsing" &&
    sessionPhase !== "latent"
  ) {
    return { ok: false, reason: "phase.browse_blocked" };
  }

  if (
    candidate.kind === "drink_pairing" &&
    !config.proactive.pairing
  ) {
    return { ok: false, reason: "proactive.pairing_disabled" };
  }

  if (
    candidate.kind === "dessert_nudge" &&
    !config.proactive.dessert
  ) {
    return { ok: false, reason: "proactive.dessert_disabled" };
  }

  if (
    candidate.kind === "slow_kitchen" &&
    !config.proactive.slowKitchen
  ) {
    return { ok: false, reason: "proactive.slow_kitchen_disabled" };
  }

  if (
    candidate.kind === "guest_welcome" &&
    !config.proactive.guestWelcome
  ) {
    return { ok: false, reason: "proactive.guest_welcome_disabled" };
  }

  if (
    candidate.kind === "browse_follow_up" &&
    !config.proactive.browseFollowUp
  ) {
    return { ok: false, reason: "proactive.browse_follow_up_disabled" };
  }

  if (
    candidate.kind === "bill_prompt" &&
    !config.proactive.billPrompt
  ) {
    return { ok: false, reason: "proactive.bill_prompt_disabled" };
  }

  if (
    candidate.kind === "order_delay" &&
    !config.proactive.orderDelay
  ) {
    return { ok: false, reason: "proactive.order_delay_disabled" };
  }

  if (
    candidate.kind === "popularity_pair" &&
    !config.proactive.popularityPairing
  ) {
    return { ok: false, reason: "proactive.popularity_disabled" };
  }

  const templateKey =
    candidate.kind === "waiter_gap" && candidate.prompt
      ? "waiter.gap_clarify.generic"
      : templateKeyForKind(candidate.kind);
  const suppressUpsell = enforceMode
    ? venueOpsSuppressUpsell(beliefs)
    : upsellSuppressedLegacy(beliefs);

  return {
    ok: true,
    templateKey,
    plan: {
      kind: "template_tell",
      requiresLlm: false,
      suppressUpsell,
      reason:
        candidate.kind === "waiter_gap"
          ? "waiter.autonomous_gap_tell"
          : candidate.kind === "attention_handoff"
            ? "mental.attention_handoff"
            : `proactive.${candidate.kind}`,
      templateKey,
    },
  };
}
