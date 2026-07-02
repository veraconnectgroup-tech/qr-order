import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
  type TurnPlan,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { resolveMentalModelMode } from "@/lib/denis/config/resolve-mental-model-mode";
import {
  deriveCheckTier,
  shouldSkipDessertForRevenueStrategy,
  shouldSuppressUpsellForHighCheck,
  type RevenueStrategy,
} from "@/lib/denis/config/revenue-intelligence";
import type { GuestProactiveNudge } from "@/lib/denis/cognition/proactive/proactive-types";
import type { SessionPhase } from "@/lib/scene/types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { mentalModelBlocksProactiveKind } from "@/lib/denis/cognition/mental-model/mental-model-intelligence";

const EATING_DESSERT_MIN_MINUTES = 15;

export type DecideProactiveTurnPlanInput = {
  beliefs: BeliefGraph;
  candidate: GuestProactiveNudge;
  sessionPhase: SessionPhase;
  config: ConciergeConfig;
  /** Open cart draft lines block proactive; submitted kitchen orders do not. */
  cartLineCount?: number;
  /** H2 — venue-wide revenue strategy from rhythm priors. */
  revenueStrategy?: RevenueStrategy | null;
  /** H2 — session check total in EUR for per-table posture. */
  sessionCheckEuros?: number;
  /** Minutes since last food delivery — eating-phase dessert gate. */
  minutesSinceLastFoodDelivery?: number | null;
  /** ADR-038 — folded guest mental model for pace/budget gates. */
  mental?: GuestMentalModel | null;
  /** ADR-043 S12 — open service recovery blocks upsell nudges. */
  activeServiceRecovery?: boolean;
};

export type ProactiveTurnPlanResult =
  | { ok: true; plan: TurnPlan; templateKey: string }
  | { ok: false; reason: string };

const UPSELL_NUDGE_KINDS: GuestProactiveNudge["kind"][] = [
  "browse_nudge",
  "drink_pairing",
  "drink_with_food",
  "sommelier_pairing",
  "sommelier_refill",
  "drink_refill",
  "round_two",
  "happy_hour_upsell",
  "dessert_nudge",
  "coffee_nudge",
  "digestif_nudge",
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
    case "sommelier_pairing":
      return "proactive.sommelier_pairing";
    case "sommelier_refill":
      return "proactive.sommelier_refill";
    case "drink_with_food":
      return "proactive.drink_with_food";
    case "drink_refill":
      return "proactive.drink_refill";
    case "round_two":
      return "proactive.round_two";
    case "happy_hour_upsell":
      return "proactive.happy_hour_upsell";
    case "dessert_nudge":
      return "proactive.dessert";
    case "coffee_nudge":
      return "proactive.coffee_after_dessert";
    case "digestif_nudge":
      return "proactive.digestif";
    case "slow_kitchen":
      return "proactive.slow_kitchen";
    case "guest_welcome":
      return "proactive.guest_welcome";
    case "browse_follow_up":
      return "proactive.browse_follow_up";
    case "table_tempo_browse":
      return "proactive.table_tempo_browse";
    case "bill_prompt":
      return "proactive.bill_prompt";
    case "order_delay":
      return "proactive.order_delay";
    case "order_eta_update":
      return "proactive.order_eta_update";
    case "order_ready":
      return "proactive.order_ready";
    case "order_ready_notify":
      return "proactive.order_ready_notify";
    case "kitchen_busy":
      return "proactive.kitchen_busy";
    case "kitchen_busy_preorder":
      return "proactive.kitchen_busy_preorder";
    case "popularity_pair":
      return "proactive.popularity_pair";
    case "party_incomplete":
      return "proactive.party_incomplete";
    case "google_review":
      return "proactive.google_review";
    case "internal_feedback":
      return "proactive.internal_feedback";
    case "scroll_search":
      return "proactive.scroll_search";
    case "scroll_category":
      return "proactive.scroll_category";
    case "scroll_bottom":
      return "proactive.scroll_bottom";
    default:
      return "proactive.browse";
  }
}

export function commerceBlocksProactive(
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
    sessionPhase === "eating" &&
    candidate.kind !== "waiter_gap" &&
    candidate.kind !== "attention_handoff"
  ) {
    if (candidate.kind === "dessert_nudge") {
      const minutes = input.minutesSinceLastFoodDelivery;
      if (minutes == null || minutes < EATING_DESSERT_MIN_MINUTES) {
        return { ok: false, reason: "phase.eating_dessert_early" };
      }
    } else {
      return { ok: false, reason: "phase.eating_do_not_disturb" };
    }
  }

  if (
    (mode === "settling" || sessionPhase === "settling") &&
    candidate.kind !== "dessert_nudge" &&
    candidate.kind !== "bill_prompt"
  ) {
    return { ok: false, reason: "session.settling" };
  }

  const enforceMode = resolveMentalModelMode(config) === "enforce";
  const receptiveness = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.mentalReceptiveness
  );

  const mentalGate = mentalModelBlocksProactiveKind({
    mental: input.mental,
    kind: candidate.kind,
    enforce: enforceMode,
  });
  if (mentalGate.blocked) {
    return { ok: false, reason: mentalGate.reason ?? "gmm.blocked" };
  }

  if (UPSELL_NUDGE_KINDS.includes(candidate.kind)) {
    if (input.activeServiceRecovery) {
      return { ok: false, reason: "service_recovery.active" };
    }

    const settlingDessertAllowed =
      candidate.kind === "dessert_nudge" &&
      (sessionPhase === "settling" ||
        sessionPhase === "eating" ||
        mode === "settling");

    if (!settlingDessertAllowed) {
      const suppressed = enforceMode
        ? venueOpsSuppressUpsell(beliefs)
        : upsellSuppressedLegacy(beliefs);
      if (suppressed) {
        return { ok: false, reason: "venue.upsell_suppressed" };
      }

      const checkTier = deriveCheckTier(input.sessionCheckEuros ?? 0);
      if (shouldSuppressUpsellForHighCheck(checkTier, receptiveness)) {
        return { ok: false, reason: "revenue.high_check_suppress" };
      }
    }
  }

  if (
    candidate.kind === "dessert_nudge" &&
    shouldSkipDessertForRevenueStrategy(input.revenueStrategy)
  ) {
    return { ok: false, reason: "revenue.turnover_skip_dessert" };
  }

  // D-NUDGE — no dessert while kitchen still has open mains (waiting/rush).
  if (candidate.kind === "dessert_nudge" && sessionPhase === "waiting") {
    return { ok: false, reason: "phase.dessert_blocked" };
  }

  if (
    (candidate.kind === "browse_nudge" ||
      candidate.kind === "cart_recovery" ||
      candidate.kind === "table_tempo_browse") &&
    sessionPhase !== "browsing" &&
    sessionPhase !== "latent"
  ) {
    return { ok: false, reason: "phase.browse_blocked" };
  }

  if (
    (candidate.kind === "drink_pairing" ||
      candidate.kind === "drink_with_food" ||
      candidate.kind === "sommelier_pairing" ||
      candidate.kind === "sommelier_refill") &&
    !config.proactive.pairing
  ) {
    return { ok: false, reason: "proactive.pairing_disabled" };
  }

  if (
    candidate.kind === "drink_refill" &&
    sessionPhase !== "browsing" &&
    sessionPhase !== "ordering" &&
    sessionPhase !== "waiting" &&
    sessionPhase !== "latent"
  ) {
    return { ok: false, reason: "phase.drink_refill_blocked" };
  }

  if (
    candidate.kind === "round_two" &&
    sessionPhase !== "waiting" &&
    sessionPhase !== "latent" &&
    sessionPhase !== "ordering"
  ) {
    return { ok: false, reason: "phase.round_two_blocked" };
  }

  if (
    candidate.kind === "happy_hour_upsell" &&
    sessionPhase !== "browsing" &&
    sessionPhase !== "ordering" &&
    sessionPhase !== "waiting" &&
    sessionPhase !== "latent"
  ) {
    return { ok: false, reason: "phase.happy_hour_blocked" };
  }

  if (
    candidate.kind === "dessert_nudge" &&
    !config.proactive.dessert
  ) {
    return { ok: false, reason: "proactive.dessert_disabled" };
  }

  if (
    (candidate.kind === "coffee_nudge" || candidate.kind === "digestif_nudge") &&
    !config.ops.dessertWindow.enabled
  ) {
    return { ok: false, reason: "proactive.dessert_window_disabled" };
  }

  if (
    candidate.kind === "digestif_nudge" &&
    !config.ops.dessertWindow.includeDigestif
  ) {
    return { ok: false, reason: "proactive.digestif_disabled" };
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
    candidate.kind === "table_tempo_browse" &&
    !config.ops.tableTempo.enabled
  ) {
    return { ok: false, reason: "proactive.table_tempo_disabled" };
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
    (candidate.kind === "order_delay" || candidate.kind === "order_eta_update") &&
    !config.proactive.orderDelay
  ) {
    return { ok: false, reason: "proactive.order_delay_disabled" };
  }

  if (
    (candidate.kind === "order_ready" || candidate.kind === "order_ready_notify") &&
    sessionPhase !== "waiting"
  ) {
    return { ok: false, reason: "phase.order_ready_blocked" };
  }

  if (
    (candidate.kind === "kitchen_busy" || candidate.kind === "kitchen_busy_preorder") &&
    sessionPhase !== "browsing" &&
    sessionPhase !== "latent" &&
    sessionPhase !== "ordering"
  ) {
    return { ok: false, reason: "phase.kitchen_busy_blocked" };
  }

  if (
    candidate.kind === "kitchen_busy_preorder" &&
    sessionPhase !== "ordering"
  ) {
    return { ok: false, reason: "phase.kitchen_busy_preorder_blocked" };
  }

  if (
    candidate.kind === "kitchen_busy" &&
    sessionPhase !== "browsing" &&
    sessionPhase !== "latent"
  ) {
    return { ok: false, reason: "phase.kitchen_busy_blocked" };
  }

  if (
    candidate.kind === "popularity_pair" &&
    !config.proactive.popularityPairing
  ) {
    return { ok: false, reason: "proactive.popularity_disabled" };
  }

  if (
    (candidate.kind === "google_review" ||
      candidate.kind === "internal_feedback") &&
    sessionPhase !== "settling"
  ) {
    return { ok: false, reason: "phase.review_blocked" };
  }

  const templateKey =
    candidate.kind === "waiter_gap" && candidate.prompt
      ? "waiter.gap_clarify.generic"
      : templateKeyForKind(candidate.kind);
  const suppressUpsell = UPSELL_NUDGE_KINDS.includes(candidate.kind)
    ? enforceMode
      ? venueOpsSuppressUpsell(beliefs)
      : upsellSuppressedLegacy(beliefs)
    : false;

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
