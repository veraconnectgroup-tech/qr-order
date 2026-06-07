import { createHash } from "node:crypto";

import { deriveAffect } from "@/lib/denis/cognition/mental-model/derive-affect";
import { deriveDeclineState } from "@/lib/denis/cognition/mental-model/decline-state";
import { deriveEngagement } from "@/lib/denis/cognition/mental-model/derive-engagement";
import { deriveGroupDynamics } from "@/lib/denis/cognition/mental-model/derive-group-dynamics";
import { deriveIntent } from "@/lib/denis/cognition/mental-model/derive-intent";
import { deriveIntentTransitions } from "@/lib/denis/cognition/mental-model/derive-intent-transitions";
import { deriveMealStage } from "@/lib/denis/cognition/mental-model/derive-meal-stage";
import { deriveNudgeBudget } from "@/lib/denis/cognition/mental-model/derive-nudge-budget";
import { derivePace } from "@/lib/denis/cognition/mental-model/derive-pace";
import { derivePriceAffinity } from "@/lib/denis/cognition/mental-model/derive-price-affinity";
import { deriveReceptiveness } from "@/lib/denis/cognition/mental-model/derive-receptiveness";
import { foldGuestSignals } from "@/lib/denis/cognition/mental-model/fold-guest-signals";
import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import { synthesizePredictedNeed } from "@/lib/denis/cognition/mental-model/synthesize-predicted-need";
import type {
  FoldGuestMentalModelInput,
  GuestMentalModel,
  GuestPosture,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import { GUEST_MENTAL_MODEL_VERSION } from "@/lib/denis/cognition/mental-model/mental-model-types";

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (v as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return v;
  });
}

function computeMentalModelHash(
  model: Omit<GuestMentalModel, "hash" | "computedAt">
): string {
  return createHash("sha256").update(stableSerialize(model)).digest("hex").slice(0, 16);
}

function deriveConfidence(input: FoldGuestMentalModelInput): number {
  let score = 0.35;

  if (input.timeline.length > 0) score += 0.15;
  if (input.browse.eventCount > 0) score += 0.1;
  if (input.conversation.thread.guestTurns > 0) score += 0.15;
  if (input.commerce.orders.length > 0) score += 0.15;
  if (input.commerce.cart.visibleLines.length > 0) score += 0.1;

  return Math.min(1, Math.round(score * 100) / 100);
}

/** Pure fold — guest posture from TableSessionState inputs (ADR-038 Val A). */
export function foldGuestMentalModel(input: FoldGuestMentalModelInput): GuestMentalModel {
  const now = input.now ?? Date.now();
  const cartLineCount = input.commerce.cart.visibleLines.length;

  const spine = foldGuestSignals({
    timeline: input.timeline,
    dismissedNudgeKeys: input.conversationMeta.dismissedNudges,
  });
  const decline = deriveDeclineState({
    spine,
    dismissedNudgeKeys: input.conversationMeta.dismissedNudges,
  });

  const intent = deriveIntent({
    phase: input.phase,
    flowNodeId: input.conversationMeta.flowNodeId,
    orders: input.commerce.orders,
    cartLineCount,
    browse: input.browse,
    conversation: input.conversation,
    billSettled: input.session.billSettled,
  });
  const intentTransitions = deriveIntentTransitions({
    intent,
    previous: input.previousFold,
    now,
  });

  const pace = derivePace({ spine, browse: input.browse });
  const receptiveness = deriveReceptiveness({
    spine,
    decline,
    conversation: input.conversation,
    browse: input.browse,
  });
  const engagement = deriveEngagement({
    spine,
    conversation: input.conversation,
  });
  const nudgeOutcomes = foldNudgeOutcomes(input.timeline, now).outcomes.map(
    (row) => row.outcome
  );
  const nudgeBudget = deriveNudgeBudget({
    spine,
    decline,
    receptiveness,
    config: input.config,
    now,
    resolvedOutcomes: nudgeOutcomes,
  });

  const mealStage = deriveMealStage({
    phase: input.phase,
    orders: input.commerce.orders,
    browse: input.browse,
    billSettled: input.session.billSettled,
  });
  const priceAffinity = derivePriceAffinity(input.browse);
  const affect = deriveAffect(spine);
  const groupDynamics = deriveGroupDynamics(input.party);
  const predictedNeed = synthesizePredictedNeed({
    intent,
    mealStage,
    receptiveness,
    pace,
    affect,
    frustrationEscalateThreshold: input.config.mentalModel.frustrationEscalateThreshold,
  });

  const withoutHash = {
    version: GUEST_MENTAL_MODEL_VERSION,
    confidence: deriveConfidence(input),
    decline,
    intent,
    intentTransitions,
    pace,
    receptiveness,
    engagement,
    nudgeBudget,
    mealStage,
    priceAffinity,
    predictedNeed,
    affect,
    groupDynamics,
  };

  return {
    ...withoutHash,
    computedAt: now,
    hash: computeMentalModelHash(withoutHash),
  };
}

/** Alias for foldGuestMentalModel — operational guest posture (Val A). */
export function foldGuestPosture(input: FoldGuestMentalModelInput): GuestPosture {
  return foldGuestMentalModel(input);
}
