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
} from "@/lib/denis/eval/run-fixtures";

/** Eval layer — fixtures, shadow diff, CI harness (M10). */
export const DENIS_EVAL_LAYER = "eval" as const;
