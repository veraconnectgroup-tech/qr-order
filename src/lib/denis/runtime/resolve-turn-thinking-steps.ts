import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
import type { TranslationKey } from "@/lib/i18n/translations";

const STATUS_REASONS = new Set([
  "commerce.status.open_order",
  "commerce.status.no_open_order",
  "commerce.order_not_sent.complaint",
  "commerce.order_not_sent.complaint_with_open_order",
  "goal.inform_status",
]);

const CART_REASONS = new Set([
  "commerce.awaiting_confirm.comprehend",
  "commerce.pressure.comprehend",
  "commerce.unsent_cart.settling_blocked",
  "goal.reconcile_cart",
]);

const CLARIFY_REASONS = new Set([
  "commerce.pending_slot.reply",
  "goal.clarify_slot.reply",
]);

const SETTLING_REASONS = new Set([
  "commerce.post_order.settling",
  "conversation.mode.settling",
]);

/** Map TDE turn plan → guest-visible thinking steps (server truth). */
export function resolveTurnThinkingStepKeys(
  turnPlan: TurnPlan,
  reflexTurn?: Pick<ReflexTurnResult, "handoffCommand"> | null
): TranslationKey[] {
  const handoffType = reflexTurn?.handoffCommand?.type;
  if (handoffType === "WAITER.REQUEST") return ["ai.chat.thinking.waiter"];
  if (
    handoffType === "BILL.REQUEST" ||
    handoffType === "BILL.SET_METHOD"
  ) {
    return ["ai.chat.thinking.payment"];
  }

  const reason = turnPlan.reason;

  if (STATUS_REASONS.has(reason)) {
    return ["ai.chat.thinking.status"];
  }

  if (SETTLING_REASONS.has(reason)) {
    return ["ai.chat.thinking.settling"];
  }

  if (CLARIFY_REASONS.has(reason)) {
    return ["ai.chat.thinking.clarify", "ai.chat.thinking.order"];
  }

  if (CART_REASONS.has(reason)) {
    return turnPlan.requiresLlm
      ? ["ai.chat.thinking.cart", "ai.chat.thinking.confirm", "ai.chat.thinking.llm"]
      : ["ai.chat.thinking.cart", "ai.chat.thinking.confirm"];
  }

  if (reason === "vague_recommend") {
    return [
      "ai.chat.thinking.menu",
      "ai.chat.thinking.recommend",
      "ai.chat.thinking.llm",
    ];
  }

  if (reason === "conversation.pure_social") {
    return ["ai.chat.thinking.social", "ai.chat.thinking.llm"];
  }

  if (reason === "conversation.continue_thread") {
    return ["ai.chat.thinking.social", "ai.chat.thinking.llm"];
  }

  if (reason === "committed_facts") {
    return ["ai.chat.thinking.facts", "ai.chat.thinking.llm"];
  }

  if (reason === "t0_reflex_or_handoff") {
    return ["ai.chat.thinking.quick"];
  }

  switch (turnPlan.kind) {
    case "reflex_only":
      return ["ai.chat.thinking.quick"];
    case "template_tell":
      return ["ai.chat.thinking.answer"];
    case "slot_extract":
      return ["ai.chat.thinking.menu", "ai.chat.thinking.order"];
    case "transactional_perceive":
      return turnPlan.requiresLlm
        ? ["ai.chat.thinking.cart", "ai.chat.thinking.order", "ai.chat.thinking.llm"]
        : ["ai.chat.thinking.cart", "ai.chat.thinking.order"];
    case "relational_perceive":
      return turnPlan.requiresLlm
        ? [
            "ai.chat.thinking.menu",
            "ai.chat.thinking.recommend",
            "ai.chat.thinking.llm",
          ]
        : ["ai.chat.thinking.menu", "ai.chat.thinking.recommend"];
    case "narrate_paraphrase":
      return ["ai.chat.thinking.facts", "ai.chat.thinking.llm"];
    default:
      return ["ai.chat.thinking.menu", "ai.chat.thinking.recommend"];
  }
}
