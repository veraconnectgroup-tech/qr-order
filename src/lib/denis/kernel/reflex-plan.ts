import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  perceiveTableGuestCommand,
  type TableGuestCommand,
} from "@/lib/denis/commands/perceive-table-guest-command";
import {
  cartLinesForSignals,
  emptyCartDraft,
  emptyCartState,
  type DenisCartDraft,
  type DenisCartState,
} from "@/lib/denis/kernel/cart-projection";
import {
  applyCorrectionCommand,
  type CorrectionOutcome,
} from "@/lib/denis/kernel/correction-protocol";
import {
  resolveCartConflict,
  type ConflictResolution,
} from "@/lib/denis/kernel/conflict";
import { planTurn, type PlanTurnResult } from "@/lib/denis/kernel/plan-turn";
import {
  resolveT0Reflex,
  type T0ReflexResult,
} from "@/lib/denis/kernel/reflex-rules";
import { resolveSkill } from "@/lib/denis/kernel/skill-registry";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";
import type { GuestIntent } from "@/lib/denis/platform/timeline-types";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";

export type ReflexTurnInput = {
  config: ConciergeConfig;
  message: string;
  flowNodeId: FlowNodeId;
  cartState?: DenisCartState;
  manualCartDraft?: DenisCartDraft;
  peerManualCartDraft?: DenisCartDraft;
  foodUpsellAsked?: boolean;
  cartConflict?: boolean;
  hasOpenOrders?: boolean;
  skipUpsell?: boolean;
  structuredIntent?: GuestIntent | null;
  handoffPaymentMethod?: SelectablePaymentMethod | null;
};

export type ReflexTurnResult = {
  reflex: T0ReflexResult | null;
  correction: CorrectionOutcome | null;
  conflict: ConflictResolution | null;
  plan: PlanTurnResult;
  cartState: DenisCartState;
  usedT0: boolean;
  handoffCommand: TableGuestCommand | null;
  handoffPaymentMethod: SelectablePaymentMethod | null;
};

function injectHandoffSkills(
  plan: PlanTurnResult,
  input: {
    intent: string;
    config: ConciergeConfig;
    handoffPaymentMethod: SelectablePaymentMethod | null;
  }
): void {
  if (input.intent === "HANDOFF_WAITER" && input.config.handoff.waiterCall) {
    const skill = resolveSkill("handoff.waiter");
    if (skill) plan.skills = [skill];
    return;
  }

  if (input.intent === "HANDOFF_PAY" && input.config.handoff.paymentHint) {
    const skill = resolveSkill("handoff.payment");
    if (skill) plan.skills = [skill];
  }
}

/** M4 + M28 — T0 reflex, handoff commands, correction before flow plan. */
export function planTurnWithReflex(input: ReflexTurnInput): ReflexTurnResult {
  const handoffPerception = perceiveTableGuestCommand({
    message: input.message,
    structuredIntent: input.structuredIntent,
    paymentMethod: input.handoffPaymentMethod,
    customPhrases: input.config.handoff.phrases,
  });

  const reflex = handoffPerception
    ? null
    : resolveT0Reflex(input.message);

  let cartState = input.cartState ?? emptyCartState();
  let correction: CorrectionOutcome | null = null;

  if (reflex?.correction) {
    correction = applyCorrectionCommand(cartState, reflex.correction, {
      maxQuantityPerLine: input.config.ordering.maxQuantityPerLine,
    });
    if (correction.ok) {
      cartState = correction.state;
    }
  }

  const intent =
    handoffPerception?.intent ?? reflex?.intent ?? "UNKNOWN";
  const handoffPaymentMethod =
    handoffPerception?.paymentMethod ?? input.handoffPaymentMethod ?? null;

  const conflict = resolveCartConflict({
    ai: cartState.draft,
    manual: input.manualCartDraft ?? emptyCartDraft(),
    peerManual: input.peerManualCartDraft,
    config: input.config,
  });

  const cartConflict =
    conflict.hasConflict || (input.cartConflict ?? false);

  const plan = planTurn({
    config: input.config,
    flowNodeId: input.flowNodeId,
    intent,
    cartItems: cartLinesForSignals(cartState.draft),
    foodUpsellAsked: input.foodUpsellAsked,
    cartConflict,
    hasOpenOrders: input.hasOpenOrders,
    skipUpsell: input.skipUpsell ?? false,
    handoffPaymentMethod,
  });

  if (correction?.ok) {
    const skill = resolveSkill(correction.skillId);
    if (skill && !plan.skills.some((s) => s.id === skill.id)) {
      plan.skills.unshift(skill);
    }
  }

  if (handoffPerception) {
    injectHandoffSkills(plan, {
      intent,
      config: input.config,
      handoffPaymentMethod,
    });
  }

  return {
    reflex,
    correction,
    conflict: conflict.hasConflict ? conflict : null,
    plan,
    cartState,
    usedT0: reflex !== null || handoffPerception !== null,
    handoffCommand: handoffPerception?.command ?? null,
    handoffPaymentMethod,
  };
}
