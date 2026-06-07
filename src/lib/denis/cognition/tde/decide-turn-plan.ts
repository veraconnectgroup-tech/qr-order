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
import { isGuestPauseMessage } from "@/lib/denis/cognition/conversation/guest-continuity";
import {
  isOrderCancelMessage,
  isOrderModifyMessage,
} from "@/lib/denis/commands/perceive-table-guest-command";
import {
  buildInterpretationTask,
  turnPlanFromInterpretationTask,
} from "@/lib/denis/cognition/tde/build-interpretation-task";
import { isGenericBeerSegment } from "@/lib/denis/cognition/conversation/guest-substitution";
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

const VAGUE_RECOMMEND_PATTERN =
  /\b(preporu[čc]|empfehl|recommend|suggest|šta da|sta da|was (soll|empfehl)|what should|surprise me|izaberi|odaberi)\b/i;

const SETTLING_GUEST_PATTERN =
  /\b(hvala|danke|thanks|that's all|to je sve|fertig|zaplat|pay|rechnung bitte|that's it|done ordering)\b/i;

const ORDER_STATUS_QUERY_PATTERN =
  /\b(kad sti[žz]e|kada sti[žz]e|gde je|gdje je|where.*order|wo ist|when.*(arriv|ready|coming)|order status|status.*order|moje pivo|my beer|jesi\s+(poslao|poslala|poslali)|da\s+li\s+(ste|si)\s+posl|poslao\s+porud[žz]bin|poslata|poslat[aoe]?|nisam\s+dobio|nisi\s+dobio|nije\s+stiglo|not\s+(sent|received|arrived)|keine\s+bestellung|da\s+li\s+ste\s+saznal)\b/i;

const MISSING_ORDER_COMPLAINT_PATTERN =
  /\b(nisi poslao|nije poslat|not sent|keine bestellung|order.*not.*(sent|received)|waiter says|konobar ka[žz]e|nisam dobio|nisi dobio|nije stiglo|gde je pivo|gdje je pivo)\b/i;

const ALREADY_ORDERED_PATTERN =
  /\b(poručio|porucio|naručio|narucio|poslao|poslata|već\s+naruč|vec\s+naruc|already ordered|bereits bestellt)\b/i;

/** @deprecated Routing hint only — not an LLM gate (ADR-025). */
const ORDERING_GUEST_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|beer|bier|weizen|pilsner|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|0[,.][35]|liter|l|schnitzel|pils|espresso|latte|molim|bitte|please|ho[ćc]u|želim|zelim|jedno|jedna|malo|veliko)\b/i;

/** Social / banter — not an order line (eval helpers only; ADR-025). */
export function isCasualSocialGuestMessage(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  if (ORDERING_GUEST_PATTERN.test(text)) return false;
  return true;
}

export function looksLikeOrderLine(message: string): boolean {
  return ORDERING_GUEST_PATTERN.test(message.trim());
}

function resolveConversationMode(
  input: DecideTurnPlanInput
): ConversationMode {
  const fromBelief = getBeliefValue<ConversationMode>(
    input.beliefs,
    CORE_BELIEF_KEYS.conversationMode
  );
  if (fromBelief) return fromBelief;
  if (SETTLING_GUEST_PATTERN.test(input.message)) return "settling";
  return "banter";
}

function resolveSuppressUpsell(beliefs: DecideTurnPlanInput["beliefs"]): boolean {
  return (
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell) === true ||
    getBeliefValue<boolean>(beliefs, CORE_BELIEF_KEYS.venueRush) === true
  );
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

const PURE_SOCIAL_BANTER_PATTERN =
  /^(zdravo|ćao|cao|hello|hi|hey|guten tag|guten abend|merhaba|que tal|ciao|hola)[\s,!.-]*((kako si|how are|sta si|sta ima|legendo|legend).*)?$/i;

function isPureSocialBanter(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 120) return false;
  return PURE_SOCIAL_BANTER_PATTERN.test(text);
}

const ORDERING_HINT_PATTERN =
  /\b(\d+\s*x|cola|kola|pivo|piva|beer|bier|burger|pizza|order|bestell|naru[čc]|poru[čc]|menu|meni|rechnung|bill|kellner|waiter|ho[ćc]u|želim|zelim|jedno|jedna|preporu[čc]|recommend|šta imate|sta imate)\b/i;

const MENU_BROWSE_PATTERN =
  /(šta imate|sta imate|what do you have|was habt ihr|šta nudite|imate li)/i;

/** Short guest reply in banter — not an order line; LLM should continue the thread. */
function isShortBanterReply(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 120) return false;
  if (ORDERING_HINT_PATTERN.test(text)) return false;
  if (/\?/.test(text) && text.length > 40) return false;
  return true;
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

/** ADR-030 — comprehend-first perceive after deterministic exits. */
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

  if (MENU_BROWSE_PATTERN.test(message)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.menu_inquiry",
    });
  }

  if (VAGUE_RECOMMEND_PATTERN.test(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "vague_recommend",
    });
  }

  if (!commerceActive && isPureSocialBanter(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "conversation.pure_social",
    });
  }

  if (!commerceActive && mode === "banter" && isGuestPauseMessage(message)) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "conversation.guest_pause",
    });
  }

  if (
    !commerceActive &&
    mode === "banter" &&
    isShortBanterReply(message)
  ) {
    return buildPlan("relational_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "conversation.continue_thread",
    });
  }

  return buildPlan("transactional_perceive", {
    requiresLlm: true,
    suppressUpsell,
    reason: commerceActive
      ? "commerce.pressure.comprehend"
      : "comprehend_first.default",
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
  if (ORDER_STATUS_QUERY_PATTERN.test(msg)) return false;
  if (MISSING_ORDER_COMPLAINT_PATTERN.test(msg)) return false;

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

export function decideTurnPlan(input: DecideTurnPlanInput): TurnPlan {
  const suppressUpsell = resolveSuppressUpsell(input.beliefs);

  const gapBlockPlan = waiterGapsBlockConfirm(input);
  if (gapBlockPlan) return gapBlockPlan;

  const gapClarifyPlan = waiterGapsClarifyTurn(input);
  if (gapClarifyPlan) return gapClarifyPlan;

  const gapResolvedPlan = waiterGapResolvedDrinkReply(input);
  if (gapResolvedPlan) return gapResolvedPlan;

  const reflexConfirmPlan = commerceReflexConfirmSubmit(input);
  if (reflexConfirmPlan) return reflexConfirmPlan;

  // ADR-030 — at recap, LLM comprehends confirm in any language; T0 is optional fast-path only.
  if (shouldComprehendConfirmTurn(input)) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.awaiting_confirm.comprehend",
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

  const goalPlan = planForTopGoal(input.reflex.plan.topGoal, suppressUpsell);
  if (goalPlan) return goalPlan;

  if (ORDER_STATUS_QUERY_PATTERN.test(input.message.trim())) {
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

  if (MISSING_ORDER_COMPLAINT_PATTERN.test(input.message.trim())) {
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

  if (MENU_BROWSE_PATTERN.test(input.message.trim())) {
    return buildPlan("transactional_perceive", {
      requiresLlm: true,
      suppressUpsell,
      reason: "commerce.menu_inquiry",
    });
  }

  const interpretationTask = buildInterpretationTask(
    input.reflex.plan.topGoal,
    input.beliefs
  );
  if (interpretationTask) {
    return buildPlan(
      interpretationTask.planKind,
      turnPlanFromInterpretationTask(interpretationTask, suppressUpsell)
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
