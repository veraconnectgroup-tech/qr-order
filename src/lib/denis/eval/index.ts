export type {
  DenisEvalScenario,
  EvalSuiteReport,
  ScenarioExpectation,
  ScenarioRunResult,
} from "@/lib/denis/eval/types";
export type {
  ShadowDenisTurn,
  ShadowDiffResult,
  ShadowLegacyTurn,
} from "@/lib/denis/runtime/shadow-types";
export { DENIS_EVAL_SCENARIOS } from "@/lib/denis/eval/fixtures/scenarios";
export { runDenisScenario, runDenisScenarioById } from "@/lib/denis/eval/run-scenario";
export {
  diffShadowTurn,
  shadowParityPassed,
  SHADOW_PARITY_THRESHOLD,
} from "@/lib/denis/runtime/shadow-diff";
export { assertRiskBoundaries, maxRiskClass } from "@/lib/denis/eval/assert-risk";
export {
  runDenisEvalSuite,
  runDenisEvalSuiteWithProductionEdgeCases,
} from "@/lib/denis/eval/run-fixtures";
export {
  persistDenisEvalRun,
  type DenisEvalRunSource,
  type PersistEvalRunInput,
  type PersistEvalRunResult,
} from "@/lib/denis/eval/persist-eval-run";
export {
  runEvalSuiteAndMaybePersist,
  type RecordEvalSuiteOptions,
  type RecordEvalSuiteResult,
} from "@/lib/denis/eval/record-eval-suite";
export {
  buildWeeklyQualityReport,
  runContinuousEvalLoop,
  runPostSessionEval,
  runProductionEdgeEvalSuite,
  scoreSessionQuality,
  SESSION_QUALITY_ANOMALY_THRESHOLD,
  type ContinuousEvalLoopResult,
  type SessionEvalResult,
  type SessionQualityScores,
  type WeeklyQualityReport,
} from "@/lib/denis/eval/continuous-eval-loop";
export {
  extractSessionLearnings,
  type ExtractedLearning,
  type SessionEvalMetrics,
  type SessionLearningKind,
} from "@/lib/denis/eval/learning-extractor";
export {
  canAutoDeployPromptEvolution,
  evaluatePromptAbTest,
  generateEvolvedPromptSection,
  PROMPT_LEARNING_THRESHOLD,
  selectPromptWinner,
  type PromptAbEvalResult,
} from "@/lib/denis/eval/prompt-evolver";
export {
  appendProductionEdgeCasesFromLearnings,
  loadProductionEdgeCases,
} from "@/lib/denis/eval/fixtures/production-edge-case-store";
export { runVenueSim } from "@/lib/denis/eval/run-venue-sim";
export {
  runVenueSimDeployGate,
  runVenueSimDeploySession,
  VENUE_SIM_MIN_OVERALL_SCORE,
} from "@/lib/denis/eval/run-venue-sim-batch";
export { runOmniscientEval } from "@/lib/denis/eval/run-omniscient-eval";
export { runAnticipationEval } from "@/lib/denis/eval/run-anticipation-eval";
export { runWaiterParitySuite } from "@/lib/denis/eval/run-waiter-parity";
export {
  runFullEvalMetrics,
  compareEvalToBaseline,
  EVAL_GATE_THRESHOLDS,
} from "@/lib/denis/eval/eval-gate";
export { applyVenueSimOverrides } from "@/lib/denis/eval/apply-venue-sim-overrides";
export { extractTimelineReplayTurns } from "@/lib/denis/eval/extract-timeline-turns";
export type {
  VenueSimReport,
  VenueSimExperimentOverrides,
  VenueSimTurnDelta,
  VenueSimMetrics,
} from "@/lib/denis/eval/venue-sim-types";

/** Eval layer — fixtures, shadow diff, venue sim (M10, M20). */
export const DENIS_EVAL_LAYER = "eval" as const;
