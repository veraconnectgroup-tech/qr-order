import { loadProductionEdgeCases } from "@/lib/denis/eval/fixtures/production-edge-case-store";
import { assertRiskBoundaries } from "@/lib/denis/eval/assert-risk";
import { DENIS_EVAL_SCENARIOS } from "@/lib/denis/eval/fixtures/scenarios";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import {
  SHADOW_PARITY_THRESHOLD,
  shadowParityPassed,
} from "@/lib/denis/runtime/shadow-diff";
import type { EvalSuiteReport, ScenarioRunResult } from "@/lib/denis/eval/types";
import { SKILL_REGISTRY, resolveSkill } from "@/lib/denis/kernel/skill-registry";

function enrichWithRiskAssert(
  scenario: (typeof DENIS_EVAL_SCENARIOS)[number],
  result: ScenarioRunResult
): ScenarioRunResult {
  const skills = result.actual.skillIds
    .map((id) => resolveSkill(id))
    .filter((skill): skill is NonNullable<typeof skill> => skill !== null);

  const risk = assertRiskBoundaries({
    skills,
    allowR5: scenario.expect.allowR5 ?? false,
  });

  if (risk.ok) return result;

  return {
    ...result,
    passed: false,
    errors: [...result.errors, ...risk.violations],
  };
}

/** Run all golden fixtures — CI entry (M10). */
export function runDenisEvalSuite(): EvalSuiteReport {
  const results = DENIS_EVAL_SCENARIOS.map((scenario) =>
    enrichWithRiskAssert(scenario, runDenisScenario(scenario))
  );

  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0,
    scenarioCount: results.length,
    passed,
    failed,
    results,
    shadowParityThreshold: SHADOW_PARITY_THRESHOLD,
  };
}

/** Run golden fixtures + auto-populated production edge cases. */
export async function runDenisEvalSuiteWithProductionEdgeCases(): Promise<EvalSuiteReport> {
  const production = await loadProductionEdgeCases();
  const all = [...DENIS_EVAL_SCENARIOS, ...production];
  const results = all.map((scenario) =>
    enrichWithRiskAssert(scenario, runDenisScenario(scenario))
  );

  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0,
    scenarioCount: results.length,
    passed,
    failed,
    results,
    shadowParityThreshold: SHADOW_PARITY_THRESHOLD,
  };
}

export { shadowParityPassed };
