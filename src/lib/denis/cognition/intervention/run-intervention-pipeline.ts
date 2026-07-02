import {
  DEFAULT_INTERVENTION_MANIFEST,
  INTERVENTION_MANIFEST_VERSION,
} from "@/lib/denis/cognition/intervention/intervention-manifest-defaults";
import { evaluateInterventionManifest } from "@/lib/denis/cognition/intervention/evaluate-intervention-manifest";
import { foldSessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import type {
  InterventionDecision,
  InterventionEvaluation,
  InterventionJournalPayload,
  InterventionManifest,
  MatchedInterventionRule,
} from "@/lib/denis/cognition/intervention/intervention-types";
import type { TableLifecycleOrchestration } from "@/lib/denis/cognition/lifecycle/table-lifecycle-types";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import type { TableTempoPhase } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { ProactiveTurnResult } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type RunInterventionPipelineInput = {
  state: TableSessionState;
  proactiveResult: ProactiveTurnResult;
  manifest?: InterventionManifest;
  tableTempoPhase?: TableTempoPhase;
  lifecycle?: TableLifecycleOrchestration | null;
  nowMs?: number;
};

function updsKindAllowedByManifest(input: {
  matchedRules: MatchedInterventionRule[];
  updsKind: GuestProactiveNudgeKind | null;
}): boolean {
  if (!input.updsKind || input.matchedRules.length === 0) return true;
  return input.matchedRules.some((row) =>
    row.allowKinds.includes(input.updsKind!)
  );
}

function reconcileDecision(input: {
  ijsDecision: InterventionEvaluation["ijsDecision"];
  updsWouldSpeak: boolean;
  enforceBlock: boolean;
}): InterventionEvaluation["decision"] {
  if (input.enforceBlock && input.updsWouldSpeak && input.ijsDecision === "silence") {
    return "silence";
  }
  if (input.updsWouldSpeak) return "speak";
  if (input.ijsDecision === "speak" && !input.updsWouldSpeak) {
    return "defer";
  }
  return input.ijsDecision;
}

/** Pure IJS evaluate — trajectory + manifest + UPDS reconcile (ADR-041). */
export function evaluateInterventionPipeline(
  input: RunInterventionPipelineInput & { enforceBlock?: boolean }
): InterventionEvaluation {
  const manifest = input.manifest ?? DEFAULT_INTERVENTION_MANIFEST;
  const nowMs = input.nowMs ?? Date.now();
  const mental = input.state.mental;
  const timing = input.state.offer?.trace.timing;

  const trajectory = foldSessionTrajectory({
    timeline: input.state.timeline,
    browse: input.state.browse,
    mental,
    orders: input.state.commerce.orders,
    cartLineCount: input.state.commerce.cart.visibleLines.length,
    timing,
    tableTempoPhase: input.tableTempoPhase,
    lifecycle: input.lifecycle,
    nowMs,
  });

  const manifestEval = evaluateInterventionManifest({
    manifest,
    trajectory,
    mental,
    offerTiming: timing,
    proactiveResult: input.proactiveResult,
  });

  const updsKind =
    input.proactiveResult.nudge?.kind ?? input.proactiveResult.candidateKind;
  const updsWouldSpeak =
    !input.proactiveResult.skipped &&
    input.proactiveResult.nudge != null &&
    Boolean(input.proactiveResult.message);

  const enforceBlock = input.enforceBlock === true;
  const kindBlocked =
    enforceBlock &&
    updsWouldSpeak &&
    !updsKindAllowedByManifest({
      matchedRules: manifestEval.matchedRules,
      updsKind,
    });

  const shouldBlockSpeak =
    (enforceBlock && updsWouldSpeak && manifestEval.ijsDecision === "silence") ||
    kindBlocked;

  const decision = reconcileDecision({
    ijsDecision: manifestEval.ijsDecision,
    updsWouldSpeak: updsWouldSpeak && !kindBlocked,
    enforceBlock,
  });

  let silenceReason = updsWouldSpeak ? null : manifestEval.silenceReason;
  if (kindBlocked) {
    silenceReason = "ijs.kind_not_allowed";
  }

  return {
    manifestVersion: manifest.version ?? INTERVENTION_MANIFEST_VERSION,
    trajectory,
    matchedRules: manifestEval.matchedRules,
    decision: kindBlocked ? "silence" : decision,
    ijsDecision: manifestEval.ijsDecision,
    updsWouldSpeak,
    shouldBlockSpeak,
    silenceReason,
    ruleId: manifestEval.ruleId,
    evidenceSignature: manifestEval.evidenceSignature,
    updsSkipReason: input.proactiveResult.skipReason,
    updsKind,
  };
}

export function buildInterventionJournalPayload(input: {
  evaluation: InterventionEvaluation;
  interventionId: string;
  source: string;
}): InterventionJournalPayload {
  return {
    type: "intervention.evaluated",
    interventionId: input.interventionId,
    manifestVersion: input.evaluation.manifestVersion,
    ruleId: input.evaluation.ruleId,
    decision: input.evaluation.decision,
    ijsDecision: input.evaluation.ijsDecision,
    updsWouldSpeak: input.evaluation.updsWouldSpeak,
    shouldBlockSpeak: input.evaluation.shouldBlockSpeak,
    silenceReason: input.evaluation.silenceReason,
    evidenceSignature: input.evaluation.evidenceSignature,
    trajectory: input.evaluation.trajectory,
    matchedRuleIds: input.evaluation.matchedRules.map((row) => row.ruleId),
    updsSkipReason: input.evaluation.updsSkipReason,
    updsKind: input.evaluation.updsKind,
    source: input.source,
  };
}

/** Resolve commerce decline reason when proactive tick ends in silence (ADR-041 P2). */
export function resolveInterventionDeclineReason(
  evaluation: InterventionEvaluation
): string | null {
  if (evaluation.shouldBlockSpeak) {
    return "ijs_enforce_block";
  }
  if (!evaluation.updsWouldSpeak) {
    return evaluation.updsSkipReason ?? "upds_silence";
  }
  if (evaluation.decision === "silence") {
    return evaluation.silenceReason ?? "ijs_silence";
  }
  return null;
}

/** True when a new proactive tick replaces a pending defer (ADR-041 P4). */
export function shouldRecordInterventionSuperseded(input: {
  previousDecision: InterventionDecision | null;
  nextDecision: InterventionDecision;
}): boolean {
  return input.previousDecision === "defer" && input.nextDecision !== "defer";
}
