import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import { isGuestAllergyRelatedMessage } from "@/lib/denis/cognition/safety/allergy-guard";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { TranslationKey } from "@/lib/i18n/translations";

export type TurnThinkingContextSignals = {
  guestMemory?: GuestMemoryProjection | null;
  cartLineCount?: number;
};

export const MAX_TURN_THINKING_STEPS = 2;

export function capTurnThinkingStepKeys(
  keys: TranslationKey[]
): TranslationKey[] {
  return keys.slice(0, MAX_TURN_THINKING_STEPS);
}

const STATUS_REASONS = [
  "commerce.status.open_order",
  "commerce.status.no_open_order",
  "commerce.order_not_sent.complaint",
  "commerce.order_not_sent.complaint_with_open_order",
  "commerce.order_change_no_open_order",
  "goal.inform_status",
] as const;

const CART_REASONS = [
  "commerce.awaiting_confirm.comprehend",
  "commerce.pressure.comprehend",
  "commerce.unsent_cart.settling_blocked",
  "goal.reconcile_cart",
] as const;

const CLARIFY_REASONS = [
  "commerce.pending_slot.reply",
  "goal.clarify_slot.reply",
] as const;

const SETTLING_REASONS = [
  "commerce.post_order.settling",
  "conversation.mode.settling",
] as const;

const T0_REASONS = [
  "t0_reflex",
  "t0_handoff",
  "t0_order_change",
  "t0_reflex_or_handoff",
] as const;

function reasonMatches(
  reasons: readonly string[],
  reason: string
): boolean {
  return reasons.includes(reason);
}

/** Map TDE turn plan → guest-visible thinking steps (server truth). */
export function resolveTurnThinkingStepKeys(
  turnPlan: TurnPlan,
  reflexTurn?: Pick<ReflexTurnResult, "handoffCommand"> | null,
  guestMessage?: string | null
): TranslationKey[] {
  const handoffType = reflexTurn?.handoffCommand?.type;
  if (handoffType === "WAITER.REQUEST") {
    return capTurnThinkingStepKeys(["ai.chat.thinking.waiter"]);
  }
  if (
    handoffType === "BILL.REQUEST" ||
    handoffType === "BILL.SET_METHOD"
  ) {
    return capTurnThinkingStepKeys(["ai.chat.thinking.payment"]);
  }

  const reason = turnPlan.reason;

  if (guestMessage && isGuestAllergyRelatedMessage(guestMessage)) {
    return capTurnThinkingStepKeys([
      "ai.chat.thinking.allergy",
      "ai.chat.thinking.menu",
    ]);
  }

  if (reasonMatches(STATUS_REASONS, reason)) {
    return capTurnThinkingStepKeys(["ai.chat.thinking.status"]);
  }

  if (reasonMatches(SETTLING_REASONS, reason)) {
    return capTurnThinkingStepKeys(["ai.chat.thinking.settling"]);
  }

  if (reasonMatches(CLARIFY_REASONS, reason)) {
    return capTurnThinkingStepKeys([
      "ai.chat.thinking.clarify",
      "ai.chat.thinking.order",
    ]);
  }

  if (reasonMatches(CART_REASONS, reason)) {
    return capTurnThinkingStepKeys(
      turnPlan.requiresLlm
        ? [
            "ai.chat.thinking.cart",
            "ai.chat.thinking.confirm",
            "ai.chat.thinking.llm",
          ]
        : ["ai.chat.thinking.cart", "ai.chat.thinking.confirm"]
    );
  }

  if (reason === "vague_recommend") {
    return capTurnThinkingStepKeys([
      "ai.chat.thinking.menu",
      "ai.chat.thinking.recommend",
      "ai.chat.thinking.llm",
    ]);
  }

  if (reason === "conversation.pure_social") {
    return capTurnThinkingStepKeys([
      "ai.chat.thinking.social",
      "ai.chat.thinking.llm",
    ]);
  }

  if (reason === "conversation.continue_thread") {
    return capTurnThinkingStepKeys([
      "ai.chat.thinking.social",
      "ai.chat.thinking.llm",
    ]);
  }

  if (reason === "conversation.guest_pause") {
    return capTurnThinkingStepKeys(["ai.chat.thinking.pause"]);
  }

  if (reason === "committed_facts") {
    return capTurnThinkingStepKeys([
      "ai.chat.thinking.facts",
      "ai.chat.thinking.llm",
    ]);
  }

  if (reasonMatches(T0_REASONS, reason)) {
    return capTurnThinkingStepKeys(["ai.chat.thinking.quick"]);
  }

  switch (turnPlan.kind) {
    case "reflex_only":
      return capTurnThinkingStepKeys(["ai.chat.thinking.quick"]);
    case "template_tell":
      return capTurnThinkingStepKeys(["ai.chat.thinking.answer"]);
    case "slot_extract":
      return capTurnThinkingStepKeys([
        "ai.chat.thinking.menu",
        "ai.chat.thinking.order",
      ]);
    case "transactional_perceive":
      return capTurnThinkingStepKeys(
        turnPlan.requiresLlm
          ? [
              "ai.chat.thinking.cart",
              "ai.chat.thinking.order",
              "ai.chat.thinking.llm",
            ]
          : ["ai.chat.thinking.cart", "ai.chat.thinking.order"]
      );
    case "relational_perceive":
      return capTurnThinkingStepKeys(
        turnPlan.requiresLlm
          ? ["ai.chat.thinking.social", "ai.chat.thinking.llm"]
          : ["ai.chat.thinking.social"]
      );
    case "narrate_paraphrase":
      return capTurnThinkingStepKeys([
        "ai.chat.thinking.facts",
        "ai.chat.thinking.llm",
      ]);
    default:
      return capTurnThinkingStepKeys([
        "ai.chat.thinking.menu",
        "ai.chat.thinking.recommend",
      ]);
  }
}

const MENU_STEP_KEYS = new Set<TranslationKey>([
  "ai.chat.thinking.menu",
  "ai.chat.thinking.recommend",
]);

function isMenuRelatedPlan(keys: TranslationKey[], turnPlan: TurnPlan): boolean {
  if (keys.some((key) => MENU_STEP_KEYS.has(key))) return true;
  return (
    turnPlan.reason === "vague_recommend" ||
    turnPlan.kind === "slot_extract" ||
    turnPlan.kind === "relational_perceive"
  );
}

function guestMemoryHasPersonalization(
  memory: GuestMemoryProjection | null | undefined
): boolean {
  if (!memory?.hasMemoryConsent) return false;
  return (
    (memory.favoriteItems?.length ?? 0) > 0 ||
    (memory.lastVisitItemNames?.length ?? 0) > 0 ||
    memory.visitCount > 1
  );
}

/** Add steps only when turn context proves that work will run. */
export function enrichTurnThinkingStepKeys(
  keys: TranslationKey[],
  turnPlan: TurnPlan,
  signals: TurnThinkingContextSignals = {}
): TranslationKey[] {
  const enriched = [...keys];

  if (
    guestMemoryHasPersonalization(signals.guestMemory) &&
    isMenuRelatedPlan(keys, turnPlan) &&
    !enriched.includes("ai.chat.thinking.favorites")
  ) {
    enriched.unshift("ai.chat.thinking.favorites");
  }

  const cartLines = signals.cartLineCount ?? 0;
  if (
    cartLines >= 4 &&
    enriched.some((key) => key === "ai.chat.thinking.order") &&
    !enriched.includes("ai.chat.thinking.largeOrder")
  ) {
    enriched.unshift("ai.chat.thinking.largeOrder");
  }

  return capTurnThinkingStepKeys(enriched);
}
