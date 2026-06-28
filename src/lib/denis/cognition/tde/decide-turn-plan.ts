import type { DenisGoal } from "@/lib/denis/kernel/goal-types";
import {
  CORE_BELIEF_KEYS,
  type ConversationMode,
  type DecideTurnPlanInput,
  getBeliefValue,
  type TurnPlan,
  type TurnPlanKind,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import type {
  CommercePressure,
  ConversationAwaiting,
} from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  isPreorderIntentMessage,
} from "@/lib/denis/commerce/preorder-flow";
import {
  isOrderCancelMessage,
  isOrderModifyMessage,
} from "@/lib/denis/commands/perceive-table-guest-command";
import {
  buildInterpretationTask,
  turnPlanFromInterpretationTask,
} from "@/lib/denis/cognition/tde/build-interpretation-task";
import {
  isGuestOrderComplaintMessage,
  isGuestSettlingMessage,
  isGuestStatusQueryMessage,
  isGuestVagueBrowseMessage,
  isVagueRecommendMessage,
} from "@/lib/denis/cognition/tde/semantic-intent-router";
import { isGenericBeerSegment } from "@/lib/denis/cognition/conversation/guest-substitution";
import { isGuestMisunderstandingDecline } from "@/lib/denis/cognition/conversation/guest-continuity";
import { isMidOrderCartSwapMessage } from "@/lib/denis/cognition/conversation/apply-guest-cart-mutations";
import {
  isGroupRoundRequestMessage,
  isReorderRequestMessage,
} from "@/lib/denis/cognition/reorder/reorder-intelligence";
import { isOrderPlacementMessage } from "@/lib/ai/ordering/order-message-backfill";
import {
  waiterGapTemplateKey,
  type WaiterGapKind,
} from "@/lib/denis/cognition/waiter";
import type { WaiterNextAction } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

const TYPED_DRINK_RESOLVES_GAP =
  /\b(pilsner|weizen|lager|radler|kisel\w*|cola|sprite|sok|juice|vino|wine|wein|espresso|latte)\b/i;

const MULTI_ITEM_ORDER_SPLIT = /\s+(?:i|und|and)\s+|,\s*/i;

const FOOD_ORDER_HINT =
  /\b(burger|pizza|steak|salat|sendvič|sendvic|pomfrit|fries|schnitzel|krompir)\b/i;

export {
  isCasualSocialGuestMessage,
  isVagueRecommendMessage,
  looksLikeOrderLine,
} from "@/lib/denis/cognition/tde/semantic-intent-router";

function resolveConversationMode(
  input: DecideTurnPlanInput
): ConversationMode {
  const fromBelief = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (fromBelief) return fromBelief;
  if (isGuestSettlingMessage(input.message)) return "settling";
  return "banter";
}

function resolveSuppressUpsell(beliefs: DecideTurnPlanInput["beliefs"]): boolean {
  if (
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell) === true ||
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueRush) === true
  ) {
    return true;
  }

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

function resolveVagueRecommendReason(beliefs: DecideTurnPlanInput["beliefs"]): string {
  const affinity = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.mentalPriceAffinity
  );
  if (affinity === "budget") return "vague_recommend.budget";
  if (affinity === "premium") return "vague_recommend.premium";
  return "vague_recommend";
}

/** GMM-11 — chat recommend anchored to folded offer (parity with proactive enrich). */
function offerAnchoredRecommendTurn(
  input: DecideTurnPlanInput,
  suppressUpsell: boolean
): TurnPlan | null {
  if (!isGuestVagueBrowseMessage(input.message.trim())) return null;
  if (hasCommercePressure(input)) return null;

  const ready =
    getBeliefValue<boolean>(
      input.beliefs,
      CORE_BELIEF_KEYS.offerReadinessReady
    ) === true;
  const productName = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.offerPrimaryProductName
  )?.trim();
  if (!ready || !productName) return null;

  return buildPlan("template_tell", {
    requiresLlm: false,
    suppressUpsell,
    reason: "offer.anchored_recommend",
    templateKey: "offer.recommend",
  });
}

/** ADR-031 C2 — guest replies always comprehend or deterministic ACT; never slot template loop. */
function planForPendingSlot(
  _slot: string,
  _message: string,
  suppressUpsell: boolean
): TurnPlan {
  return buildPlan("transactional_perceive", {
    requiresLlm: true,
    suppressUpsell,
    reason: "commerce.pending_slot.reply",
  });
}

function planForTopGoal(
  goal: DenisGoal | null,
  suppressUpsell: boolean
): TurnPlan | null {
  if (!goal) return null;

  if (goal.type === "RECONCILE_CART") {
    return {
      kind: "template_tell",
      requiresLlm: false,
      suppressUpsell,
      reason: "goal.reconcile_cart",
      templateKey: "cart.conflict",
    };
  }

  if (goal.type === "CLARIFY_SLOT") {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "goal.clarify_slot.reply",
    });
  }

  if (goal.type === "INFORM_STATUS") {
    return {
      kind: "template_tell",
      requiresLlm: false,
      suppressUpsell,
      reason: "goal.inform_status",
      templateKey: "status.headline",
    };
  }

  if (goal.type === "UPSELL_ONCE" && suppressUpsell) {
    return null;
  }

  return null;
}

function planForCommittedFacts(
  facts: DecideTurnPlanInput["committedFacts"],
  suppressUpsell: boolean
): TurnPlan | null {
  if (!facts?.length) return null;
  return {
    kind: "narrate_paraphrase",
    requiresLlm: true,
    suppressUpsell,
    reason: "committed_facts",
  };
}

function buildPlan(
  kind: TurnPlanKind,
  partial: Omit<TurnPlan, "kind">
): TurnPlan {
  return { kind, ...partial };
}

function hasCommercePressure(input: DecideTurnPlanInput): boolean {
  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const mode = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );

  return (
    pressure === "open" ||
    pressure === "confirm" ||
    awaiting != null ||
    Boolean(pendingSlot) ||
    mode === "ordering"
  );
}

/** ADR-030 + ADR-025 — comprehend-first perceive after deterministic exits. */
function resolvePerceivePlan(
  input: DecideTurnPlanInput,
  suppressUpsell: boolean
): TurnPlan {
  const mode = resolveConversationMode(input);
  const message = input.message.trim();
  const commerceActive = hasCommercePressure(input);

  if (mode === "settling") {
    const pressure = getBeliefValue<CommercePressure>(
      input.beliefs,
      CORE_BELIEF_KEYS.commercePressure
    );
    const pendingSlot = getBeliefValue<string>(
      input.beliefs,
      CORE_BELIEF_KEYS.commercePendingSlot
    );
    const hasOpenOrders =
      getBeliefValue<boolean>(
        input.beliefs,
        CORE_BELIEF_KEYS.commerceHasOpenOrders
      ) === true;

    if (
      hasOpenOrders &&
      pressure !== "open" &&
      pressure !== "confirm" &&
      !pendingSlot
    ) {
      return buildPlan("template_tell", {
        requiresLlm: false,
        suppressUpsell,
        reason: "commerce.post_order.settling",
        templateKey: "settle.thanks",
      });
    }

    if (pressure === "open" || pressure === "confirm" || pendingSlot) {
      return buildPlan("transactional_perceive", {
        requiresLlm: true,
        suppressUpsell,
        reason: "commerce.unsent_cart.settling_blocked",
      });
    }

    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "conversation.mode.settling",
      templateKey: "settle.thanks",
    });
  }

  if (isVagueRecommendMessage(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: resolveVagueRecommendReason(input.beliefs),
    });
  }

  if (commerceActive || mode === "ordering") {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.pressure.comprehend",
    });
  }

  return buildPlan("relational_perceive", {
    requiresLlm: true,
    suppressUpsell,
    reason: "comprehend_first.default",
  });
}

function hasDeliveredCommerceOrders(
  beliefs: DecideTurnPlanInput["beliefs"]
): boolean {
  return (
    getBeliefValue<boolean>(
      beliefs,
      CORE_BELIEF_KEYS.commerceHasDeliveredOrders
    ) === true
  );
}

/** P1 — guest says "još jedno" / "same again" → direct reorder ACT (no dock confirm). */
function commerceReorderGuestRequestReflex(
  input: DecideTurnPlanInput
): TurnPlan | null {
  const message = input.message.trim();
  if (!message || !isReorderRequestMessage(message)) return null;
  if (isGroupRoundRequestMessage(message)) return null;

  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  if (pressure === "open" || pressure === "confirm") return null;

  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (pendingSlot) return null;

  if (!hasDeliveredCommerceOrders(input.beliefs)) return null;

  return buildPlan("reflex_only", {
    requiresLlm: false,
    suppressUpsell: resolveSuppressUpsell(input.beliefs),
    reason: "commerce.reorder.guest_request",
  });
}

function hasOpenCommerceOrders(beliefs: DecideTurnPlanInput["beliefs"]): boolean {
  return (
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.commerceHasOpenOrders) ===
    true
  );
}

/**
 * Reflex-only when T0 handled the turn, or waiter/bill handoff fired.
 * ORDER cancel/modify only reflex when kitchen has an open order — otherwise comprehend.
 */
function shouldUseReflexOnly(input: DecideTurnPlanInput): boolean {
  const cmd = input.reflex.handoffCommand;
  if (input.reflex.reflex) return true;
  if (!cmd) return false;

  if (cmd.type === "ORDER.CANCEL" || cmd.type === "ORDER.MODIFY") {
    return hasOpenCommerceOrders(input.beliefs);
  }

  return true;
}

const VAGUE_COMPREHEND_PATTERN =
  /\b(ne[šs]to|nesto|something|anything|hladno|toplo|vegans?|gluten\s*free)\b/i;

function looksLikeMenuQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\?/.test(text) ||
    /\b(koliko|ko[sš]ta|kosta|šta je|sta je|what is|how much|ima li|jel ima|je li|was ist|was kostet)\b/i.test(
      text
    )
  );
}

function shouldComprehendOrderLineOverride(
  message: string,
  topGoalType: DenisGoal["type"] | undefined
): boolean {
  if (topGoalType !== "GUEST_SEATED" && topGoalType !== "COMPLETE_ROUND") {
    return false;
  }
  const text = message.trim();
  if (!text || !isOrderPlacementMessage(text)) return false;
  if (looksLikeMenuQuestion(text)) return false;
  if (VAGUE_COMPREHEND_PATTERN.test(text)) return false;
  return true;
}

/** Settling guest line — template thanks beats T0 DONE reflex (comprehension eval / ADR-025). */
function shouldSettleTemplateTurn(input: DecideTurnPlanInput): boolean {
  const trimmed = input.message.trim();
  if (!isGuestSettlingMessage(trimmed)) return false;

  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (pressure === "open" || pressure === "confirm" || pendingSlot) {
    return false;
  }

  const mode = resolveConversationMode(input);
  if (mode === "ordering") return false;

  return mode === "settling" || isGuestSettlingMessage(trimmed);
}

/** ADR-030 — LLM confirm at recap; T0 cart edits (add/remove) stay reflex_only. */
function shouldComprehendConfirmTurn(input: DecideTurnPlanInput): boolean {
  if (!input.message.trim()) return false;

  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const atConfirmPressure = pressure === "confirm" || awaiting === "confirm";
  const intent = input.reflex.reflex?.intent;
  const trimmed = input.message.trim();

  if (intent === "CONFIRM" || intent === "DECLINE") {
    if (!atConfirmPressure && isOrderPlacementMessage(trimmed)) {
      return false;
    }
    return true;
  }
  if (intent === "DONE" && atConfirmPressure) return true;

  if (!atConfirmPressure) return false;

  // T0 cart edits at recap (add/remove) — reflex_only; confirm/DONE handled above.
  if (input.reflex.usedT0 && intent !== "DONE") {
    return false;
  }

  return true;
}

function comprehendConfirmReason(input: DecideTurnPlanInput): string {
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const intent = input.reflex.reflex?.intent;
  const trimmed = input.message.trim();

  if (
    intent === "DECLINE" &&
    isGuestMisunderstandingDecline(trimmed) &&
    awaiting != null &&
    awaiting !== "confirm"
  ) {
    return "conversation.decline_recovery.comprehend";
  }

  return "commerce.awaiting_confirm.comprehend";
}

/** Short product pick when Denis offered options — not a fresh order line. */
function shouldComprehendConversationPickTurn(
  input: DecideTurnPlanInput
): boolean {
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  if (
    awaiting !== "recommendation_pick" &&
    awaiting !== "product" &&
    awaiting !== "modifier" &&
    awaiting !== "serve_size"
  ) {
    return false;
  }

  const trimmed = input.message.trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (input.reflex.reflex?.intent === "CONFIRM") return false;
  if (input.reflex.reflex?.intent === "DECLINE") return false;
  if (isOrderPlacementMessage(trimmed)) return false;

  return true;
}

function guestResolvesActiveGap(input: DecideTurnPlanInput): boolean {
  const primaryGap =
    getBeliefValue<WaiterGapKind | null>(
      input.beliefs,
      CORE_BELIEF_KEYS.waiterPrimaryGap
    ) ?? null;
  const msg = input.message.trim();
  if (!msg || !primaryGap) return false;

  if (primaryGap === "drink_unspecified") {
    if (TYPED_DRINK_RESOLVES_GAP.test(msg)) return true;
    if (isGenericBeerSegment(msg)) return false;
    return false;
  }

  if (primaryGap === "serve_size") {
    return /\b0[,.][35]\s*l?\b/i.test(msg);
  }

  return false;
}

function shouldTemplateWaiterGapClarify(input: DecideTurnPlanInput): boolean {
  const msg = input.message.trim();
  if (!msg) return false;
  if (isGuestStatusQueryMessage(msg)) return false;
  if (isGuestOrderComplaintMessage(msg)) return false;

  const primaryGap =
    getBeliefValue<WaiterGapKind | null>(
      input.beliefs,
      CORE_BELIEF_KEYS.waiterPrimaryGap
    ) ?? null;

  if (primaryGap === "substitution_note") {
    return isOrderPlacementMessage(msg);
  }

  if (primaryGap === "drink_unspecified") {
    if (
      MULTI_ITEM_ORDER_SPLIT.test(msg) &&
      FOOD_ORDER_HINT.test(msg) &&
      isOrderPlacementMessage(msg)
    ) {
      return true;
    }

    const pressure = getBeliefValue<CommercePressure>(
      input.beliefs,
      CORE_BELIEF_KEYS.commercePressure
    );
    const awaiting = getBeliefValue<ConversationAwaiting>(
      input.beliefs,
      CORE_BELIEF_KEYS.conversationAwaiting
    );
    if (
      (pressure === "open" ||
        pressure === "confirm" ||
        awaiting === "confirm") &&
      isOrderPlacementMessage(msg) &&
      !isGenericBeerSegment(msg)
    ) {
      return true;
    }
  }

  return false;
}

/** ADR-033 — template clarify for combo/substitution gaps (no LLM on iota pilot path). */
function waiterGapsClarifyTurn(input: DecideTurnPlanInput): TurnPlan | null {
  const gapCount =
    getBeliefValue<number>(input.beliefs, CORE_BELIEF_KEYS.waiterGapCount) ?? 0;
  if (gapCount <= 0) return null;

  const nextAction =
    getBeliefValue<WaiterNextAction>(
      input.beliefs,
      CORE_BELIEF_KEYS.waiterNextAction
    ) ?? null;
  if (nextAction !== "clarify_gap") return null;

  const intent = input.reflex.reflex?.intent;
  const trimmed = input.message.trim();
  if (intent === "DECLINE" || intent === "DONE") return null;
  if (intent === "CONFIRM" && !isOrderPlacementMessage(trimmed)) return null;

  if (guestResolvesActiveGap(input)) return null;
  if (!shouldTemplateWaiterGapClarify(input)) return null;

  const primaryGap =
    getBeliefValue<WaiterGapKind | null>(
      input.beliefs,
      CORE_BELIEF_KEYS.waiterPrimaryGap
    ) ?? null;

  return buildPlan("template_tell", {
    requiresLlm: false,
    suppressUpsell: resolveSuppressUpsell(input.beliefs),
    reason: "waiter.gap_clarify",
    templateKey: waiterGapTemplateKey(primaryGap),
  });
}

/**
 * ADR-023 §4 + ADR-025 — single code path between FOLD and perceive.
 * Director decides LLM vs template; does not call OpenAI.
 */
function waiterGapsBlockConfirm(input: DecideTurnPlanInput): TurnPlan | null {
  const gapCount =
    getBeliefValue<number>(input.beliefs, CORE_BELIEF_KEYS.waiterGapCount) ?? 0;
  if (gapCount <= 0) return null;

  const canConfirm =
    getBeliefValue<boolean>(input.beliefs, CORE_BELIEF_KEYS.waiterCanConfirm) ===
    true;
  if (canConfirm) return null;

  const pressure = getBeliefValue<CommercePressure>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePressure
  );
  const awaiting = getBeliefValue<ConversationAwaiting>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationAwaiting
  );
  const atConfirm = pressure === "confirm" || awaiting === "confirm";
  const intent = input.reflex.reflex?.intent;
  const trimmed = input.message.trim();

  if (!atConfirm && intent !== "CONFIRM" && intent !== "DONE") return null;

  // T0 may tag leading "može" on an order line as CONFIRM — not recap confirm.
  if (
    !atConfirm &&
    (intent === "CONFIRM" || intent === "DONE") &&
    isOrderPlacementMessage(trimmed)
  ) {
    return null;
  }

  const primaryGap =
    getBeliefValue<WaiterGapKind | null>(
      input.beliefs,
      CORE_BELIEF_KEYS.waiterPrimaryGap
    ) ?? null;

  return buildPlan("template_tell", {
    requiresLlm: false,
    suppressUpsell: resolveSuppressUpsell(input.beliefs),
    reason: "waiter.gap_blocks_confirm",
    templateKey: waiterGapTemplateKey(primaryGap),
  });
}

/** Guest named a typed drink — close gap via backfill, no LLM round-trip (ADR-033). */
function waiterGapResolvedDrinkReply(
  input: DecideTurnPlanInput
): TurnPlan | null {
  const primaryGap =
    getBeliefValue<WaiterGapKind | null>(
      input.beliefs,
      CORE_BELIEF_KEYS.waiterPrimaryGap
    ) ?? null;
  if (primaryGap !== "drink_unspecified") return null;
  if (!guestResolvesActiveGap(input)) return null;

  return buildPlan("reflex_only", {
    requiresLlm: false,
    suppressUpsell: resolveSuppressUpsell(input.beliefs),
    reason: "waiter.gap_resolved.drink_reply",
  });
}

/** T0 confirm + empty obligation → ACT submit without LLM comprehend (iota pilot S3). */
function commerceReflexConfirmSubmit(
  input: DecideTurnPlanInput
): TurnPlan | null {
  const gapCount =
    getBeliefValue<number>(input.beliefs, CORE_BELIEF_KEYS.waiterGapCount) ?? 0;
  if (gapCount > 0) return null;

  const canConfirm =
    getBeliefValue<boolean>(input.beliefs, CORE_BELIEF_KEYS.waiterCanConfirm) ===
    true;
  if (!canConfirm) return null;

  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (pendingSlot) return null;

  const intent = input.reflex.reflex?.intent;
  const trimmed = input.message.trim();
  const normalized = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const confirmLike =
    intent === "CONFIRM" ||
    intent === "DONE" ||
    normalized === "da" ||
    normalized === "ja" ||
    normalized === "yes" ||
    (input.reflex.usedT0 &&
      (normalized === "moze" ||
        normalized === "ajde" ||
        normalized === "super" ||
        normalized === "posalji"));
  if (!confirmLike) return null;

  const hasSubmitSkill = input.reflex.plan.skills.some(
    (skill) => skill.id === "order.submit"
  );
  if (!hasSubmitSkill && !input.reflex.usedT0) return null;

  return buildPlan("reflex_only", {
    requiresLlm: false,
    suppressUpsell: resolveSuppressUpsell(input.beliefs),
    reason: "commerce.confirm.reflex_submit",
  });
}

/** ADR-038 GMM-7 — frustrated posture → empathy + waiter escalation (reactive). */
function mentalAttentionEscalationTurn(
  input: DecideTurnPlanInput
): TurnPlan | null {
  const predictedNeed = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.mentalPredictedNeed
  );
  if (predictedNeed !== "needs_attention") return null;

  const msg = input.message.trim();
  if (!msg) return null;

  const statusQuery = isGuestStatusQueryMessage(msg);
  const missingComplaint = isGuestOrderComplaintMessage(msg);
  const frustration =
    getBeliefValue<string>(input.beliefs, CORE_BELIEF_KEYS.mentalFrustration) ??
    "none";

  if (!statusQuery && !missingComplaint && frustration !== "high") {
    return null;
  }

  if (statusQuery && !hasOpenCommerceOrders(input.beliefs)) {
    return null;
  }

  return buildPlan("template_tell", {
    requiresLlm: false,
    suppressUpsell: true,
    reason: "mental.attention_handoff",
    templateKey: "mental.attention_handoff",
  });
}

export function decideTurnPlan(input: DecideTurnPlanInput): TurnPlan {
  const suppressUpsell = resolveSuppressUpsell(input.beliefs);

  if (isPreorderIntentMessage(input.message.trim())) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell: true,
      reason: "commerce.preorder.scheduled",
    });
  }

  const gapBlockPlan = waiterGapsBlockConfirm(input);
  if (gapBlockPlan) return gapBlockPlan;

  const mentalAttentionPlan = mentalAttentionEscalationTurn(input);
  if (mentalAttentionPlan) return mentalAttentionPlan;

  const gapClarifyPlan = waiterGapsClarifyTurn(input);
  if (gapClarifyPlan) return gapClarifyPlan;

  const gapResolvedPlan = waiterGapResolvedDrinkReply(input);
  if (gapResolvedPlan) return gapResolvedPlan;

  const reflexConfirmPlan = commerceReflexConfirmSubmit(input);
  if (reflexConfirmPlan) return reflexConfirmPlan;

  const reorderGuestPlan = commerceReorderGuestRequestReflex(input);
  if (reorderGuestPlan) return reorderGuestPlan;

  // ADR-030 — at recap, LLM comprehends confirm in any language; T0 is optional fast-path only.
  if (shouldComprehendConfirmTurn(input)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: comprehendConfirmReason(input),
    });
  }

  if (shouldComprehendConversationPickTurn(input)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "conversation.awaiting_pick.comprehend",
    });
  }

  if (hasCommercePressure(input) && isMidOrderCartSwapMessage(input.message)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.cart_mutation.comprehend",
    });
  }

  if (shouldSettleTemplateTurn(input)) {
    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "conversation.mode.settling",
      templateKey: "settle.thanks",
    });
  }

  if (input.reflex.usedT0 || input.reflex.handoffCommand) {
    return buildPlan("reflex_only", {
      requiresLlm: false,
      suppressUpsell,
      reason: "t0_reflex_or_handoff",
    });
  }

  const pendingSlot = getBeliefValue<string>(
    input.beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  if (pendingSlot) {
    return planForPendingSlot(pendingSlot, input.message, suppressUpsell);
  }

  if (isGuestStatusQueryMessage(input.message.trim())) {
    if (!hasOpenCommerceOrders(input.beliefs)) {
      return buildPlan("template_tell", {
        requiresLlm: false,
        suppressUpsell,
        reason: "commerce.status.no_open_order",
        templateKey: "status.no_order",
      });
    }
    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "commerce.status.open_order",
      templateKey: "status.headline",
    });
  }

  if (isGuestOrderComplaintMessage(input.message.trim())) {
    if (!hasOpenCommerceOrders(input.beliefs)) {
      return buildPlan("template_tell", {
        requiresLlm: false,
        suppressUpsell,
        reason: "commerce.order_not_sent.complaint",
        templateKey: "status.no_order",
      });
    }
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.order_not_sent.complaint_with_open_order",
    });
  }

  const goalPlan = planForTopGoal(input.reflex.plan.topGoal, suppressUpsell);
  if (goalPlan) return goalPlan;

  const trimmedMessage = input.message.trim();
  if (
    (isOrderCancelMessage(trimmedMessage) ||
      isOrderModifyMessage(trimmedMessage)) &&
    !hasOpenCommerceOrders(input.beliefs)
  ) {
    return buildPlan("template_tell", {
      requiresLlm: false,
      suppressUpsell,
      reason: "commerce.order_change_no_open_order",
      templateKey: "status.no_order",
    });
  }

  const narratePlan = planForCommittedFacts(
    input.committedFacts,
    suppressUpsell
  );
  if (narratePlan) return narratePlan;

  const offerRecommendPlan = offerAnchoredRecommendTurn(input, suppressUpsell);
  if (offerRecommendPlan) return offerRecommendPlan;

  if (resolveConversationMode(input) === "settling") {
    return resolvePerceivePlan(input, suppressUpsell);
  }

  const interpretationTask = buildInterpretationTask(
    input.reflex.plan.topGoal,
    input.beliefs,
    {
      guestMessage: input.message,
      conversationGraph: input.conversationGraph,
    }
  );
  if (interpretationTask) {
    const topGoalType = input.reflex.plan.topGoal?.type;
    let planKind = interpretationTask.planKind;
    let reason = interpretationTask.reason;

    if (shouldComprehendOrderLineOverride(input.message.trim(), topGoalType)) {
      planKind = "transactional_perceive";
      reason = "comprehend_first.order_line";
    }

    return buildPlan(
      planKind,
      turnPlanFromInterpretationTask(
        { ...interpretationTask, planKind, reason },
        suppressUpsell
      )
    );
  }

  return resolvePerceivePlan(input, suppressUpsell);
}

/** Whether DECIDE may attach upsell goals for this turn (MR-2 acceptance). */
export function turnPlanAllowsUpsell(
  plan: TurnPlan,
  topGoal: DenisGoal | null
): boolean {
  if (plan.suppressUpsell) return false;
  if (plan.kind === "reflex_only" || plan.kind === "transactional_perceive") {
    return false;
  }
  if (topGoal?.type === "UPSELL_ONCE") return true;
  return plan.kind === "relational_perceive";
}
