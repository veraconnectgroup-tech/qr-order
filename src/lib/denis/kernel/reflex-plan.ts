import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
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
};

export type ReflexTurnResult = {
  reflex: T0ReflexResult | null;
  correction: CorrectionOutcome | null;
  conflict: ConflictResolution | null;
  plan: PlanTurnResult;
  cartState: DenisCartState;
  usedT0: boolean;
};

/** M4 — T0 reflex + correction before flow plan. */
export function planTurnWithReflex(input: ReflexTurnInput): ReflexTurnResult {
  const reflex = resolveT0Reflex(input.message);
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

  const intent = reflex?.intent ?? "UNKNOWN";

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
  });

  if (correction?.ok) {
    const skill = resolveSkill(correction.skillId);
    if (skill && !plan.skills.some((s) => s.id === skill.id)) {
      plan.skills.unshift(skill);
    }
  }

  return {
    reflex,
    correction,
    conflict: conflict.hasConflict ? conflict : null,
    plan,
    cartState,
    usedT0: reflex !== null,
  };
}
