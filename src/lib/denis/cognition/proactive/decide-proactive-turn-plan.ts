import {
  CORE_BELIEF_KEYS,
  getBeliefValue,
  type BeliefGraph,
  type TurnPlan,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import type { GuestProactiveNudge } from "@/lib/denis/runtime/evaluate-proactive-tick";
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

const UPSELL_NUDGE_KINDS = new Set<GuestProactiveNudge["kind"]>([
  "drink_pairing",
  "dessert_nudge",
]);

function templateKeyForKind(kind: GuestProactiveNudge["kind"]): string {
  switch (kind) {
    case "browse_nudge":
      return "proactive.browse";
    case "drink_pairing":
      return "proactive.drink_pairing";
    case "dessert_nudge":
      return "proactive.dessert";
    case "slow_kitchen":
      return "proactive.slow_kitchen";
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

function upsellSuppressed(beliefs: BeliefGraph): boolean {
  return (
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell) ===
      true ||
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueRush) === true
  );
}

/**
 * ADR-023 D-PRO — proactive nudge routing through TDE beliefs (phase guards).
 */
export function decideProactiveTurnPlan(
  input: DecideProactiveTurnPlanInput
): ProactiveTurnPlanResult {
  const { beliefs, candidate, sessionPhase, config } = input;

  if (!config.proactive.enabled) {
    return { ok: false, reason: "proactive.disabled" };
  }

  if (commerceBlocksProactive(beliefs, input.cartLineCount ?? 0)) {
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
    candidate.kind !== "dessert_nudge"
  ) {
    return { ok: false, reason: "session.settling" };
  }

  if (UPSELL_NUDGE_KINDS.has(candidate.kind) && upsellSuppressed(beliefs)) {
    return { ok: false, reason: "venue.upsell_suppressed" };
  }

  // D-NUDGE — no dessert while kitchen still has open mains (waiting/rush).
  if (candidate.kind === "dessert_nudge" && sessionPhase === "waiting") {
    return { ok: false, reason: "phase.dessert_blocked" };
  }

  if (
    candidate.kind === "browse_nudge" &&
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

  const templateKey = templateKeyForKind(candidate.kind);
  const suppressUpsell = upsellSuppressed(beliefs);

  return {
    ok: true,
    templateKey,
    plan: {
      kind: "template_tell",
      requiresLlm: false,
      suppressUpsell,
      reason: `proactive.${candidate.kind}`,
      templateKey,
    },
  };
}
