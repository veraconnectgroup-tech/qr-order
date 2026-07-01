import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { OfferTiming } from "@/lib/denis/cognition/offer/offer-types";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import type { ProactiveTurnResult } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import type { SessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";

import type { InterventionMode } from "@/lib/denis/config/intervention-mode";

export type { InterventionMode };

export type InterventionDecision = "speak" | "silence" | "defer";

export type DenisRiskClass = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

export type TrajectoryOrdering = SessionTrajectory["ordering"];
export type TrajectoryEngagement = SessionTrajectory["engagement"];
export type TrajectoryMeal = SessionTrajectory["meal"];

export type TrajectoryPredicate = Partial<{
  ordering: TrajectoryOrdering;
  engagement: TrajectoryEngagement;
  meal: TrajectoryMeal;
  minOpportunity: number;
  maxInterruptionRisk: number;
}>;

export type MentalPredicate = Partial<{
  predictedNeed: GuestMentalModel["predictedNeed"];
  intent: GuestMentalModel["intent"];
  receptiveness: GuestMentalModel["receptiveness"];
  mealStage: GuestMentalModel["mealStage"];
}>;

export type OfferPredicate = Partial<{
  timingReady: boolean;
  timingKind: OfferTiming["kind"];
}>;

export type InterventionRule = {
  id: string;
  when: {
    trajectory?: TrajectoryPredicate;
    mental?: MentalPredicate;
    offer?: OfferPredicate;
  };
  allow: {
    kinds: GuestProactiveNudgeKind[];
    riskClass: DenisRiskClass;
  };
  defer?: {
    debounceSec: number;
    maxPerSession: number;
  };
};

export type InterventionManifest = {
  version: string;
  rules: InterventionRule[];
};

export type MatchedInterventionRule = {
  ruleId: string;
  allowKinds: GuestProactiveNudgeKind[];
  riskClass: DenisRiskClass;
};

export type InterventionEvaluation = {
  manifestVersion: string;
  trajectory: SessionTrajectory;
  matchedRules: MatchedInterventionRule[];
  decision: InterventionDecision;
  /** IJS-only decision before UPDS reconcile */
  ijsDecision: InterventionDecision;
  /** UPDS would speak */
  updsWouldSpeak: boolean;
  /** Block emit in enforce when IJS says silence but UPDS would speak */
  shouldBlockSpeak: boolean;
  silenceReason: string | null;
  ruleId: string | null;
  evidenceSignature: string;
  updsSkipReason: string | null;
  updsKind: GuestProactiveNudgeKind | null;
};

export type InterventionJournalPayload = {
  type: "intervention.evaluated";
  interventionId: string;
  manifestVersion: string;
  ruleId: string | null;
  decision: InterventionDecision;
  ijsDecision: InterventionDecision;
  updsWouldSpeak: boolean;
  shouldBlockSpeak: boolean;
  silenceReason: string | null;
  evidenceSignature: string;
  trajectory: SessionTrajectory;
  matchedRuleIds: string[];
  updsSkipReason: string | null;
  updsKind: GuestProactiveNudgeKind | null;
  source: string;
};

export type InterventionDeclinedPayload = {
  type: "intervention.declined";
  interventionId: string;
  manifestVersion: string;
  ruleId: string | null;
  reason: string;
  evidenceSignature: string;
  updsKind: GuestProactiveNudgeKind | null;
  updsSkipReason: string | null;
  source: string;
};

export type InterventionCommittedPayload = {
  type: "intervention.committed";
  interventionId: string;
  manifestVersion: string;
  ruleId: string | null;
  updsKind: GuestProactiveNudgeKind | null;
  evidenceSignature: string;
  source: string;
};

export type InterventionExpiredPayload = {
  type: "intervention.expired";
  interventionId: string;
  manifestVersion: string;
  ruleId: string | null;
  reason: string;
  evidenceSignature: string;
  source: string;
};

export type InterventionSupersededPayload = {
  type: "intervention.superseded";
  interventionId: string;
  manifestVersion: string;
  ruleId: string | null;
  reason: string;
  supersededByTraceId: string;
  source: string;
};

export type EvaluateInterventionInput = {
  trajectory: SessionTrajectory;
  mental: GuestMentalModel;
  offerTiming: OfferTiming | null | undefined;
  proactiveResult: ProactiveTurnResult;
  manifest: InterventionManifest;
};
