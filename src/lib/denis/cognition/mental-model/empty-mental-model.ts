import { emptyGuestPredictiveModel } from "@/lib/denis/cognition/mental-model/empty-predictive-model";
import type {
  GuestMentalModel,
  GuestPosture,
  GuestMentalModelFusion,
} from "@/lib/denis/cognition/mental-model/mental-model-types";
import { GUEST_MENTAL_MODEL_VERSION } from "@/lib/denis/cognition/mental-model/mental-model-types";

const EMPTY_FUSION: GuestMentalModelFusion = {
  readiness: { score: 0, band: "low", offerSubmit: false },
  guidance: {
    style: "default",
    nextLogicalStep: "exploring",
    abnormalTransition: null,
    hint: null,
  },
  anomalies: [],
};

/** Eval / test fixture — neutral baseline before fold. */
export function emptyGuestMentalModel(now = 0): GuestMentalModel {
  return {
    version: GUEST_MENTAL_MODEL_VERSION,
    computedAt: now,
    confidence: 0,
    hash: "empty",
    decline: {
      dismissedCount: 0,
      explicitCount: 0,
      hardClosed: false,
      lastDeclineAt: null,
    },
    intent: "arrived",
    intentTransitions: [],
    pace: "normal",
    receptiveness: "neutral",
    engagement: {
      guestTurns: 0,
      avgMsgLen: 0,
      guestInitiated: false,
      nudgeResponseRate: 0,
    },
    nudgeBudget: {
      remaining: 0,
      max: 0,
      cooldownUntil: null,
    },
    mealStage: "pre_order",
    priceAffinity: "unknown",
    predictedNeed: "none",
    affect: {
      frustration: { level: "none", signals: [] },
      sentiment: { score: 0, lastSignals: [] },
    },
    groupDynamics: {
      mode: "solo",
      leaderDevice: null,
      followerDevices: [],
      addressLeader: true,
    },
    fusion: EMPTY_FUSION,
    predictions: emptyGuestPredictiveModel(),
  };
}

export function emptyGuestPosture(now = 0): GuestPosture {
  return emptyGuestMentalModel(now);
}
