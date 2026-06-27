import { runPilotGate, type PilotGateReport } from "@/lib/denis/eval/run-pilot-gate";

const MIN_EVAL_PASS_RATE_PCT = 95;

export { MIN_EVAL_PASS_RATE_PCT };

export function computePilotEvalPassRate(gate: PilotGateReport): number {
  const suites = [
    { passed: gate.core.passed, total: gate.core.scenarioCount },
    { passed: gate.pilotSr.passed, total: gate.pilotSr.scenarioCount },
    { passed: gate.waiterParity.passed, total: gate.waiterParity.scenarioCount },
    { passed: gate.anticipation.passed, total: gate.anticipation.scenarioCount },
    { passed: gate.narration.passed ? 1 : 0, total: 1 },
    { passed: gate.qualityContract.ok ? 1 : 0, total: 1 },
  ];

  const total = suites.reduce((sum, row) => sum + row.total, 0);
  const passed = suites.reduce((sum, row) => sum + row.passed, 0);
  if (total <= 0) return 0;
  return Math.round((passed / total) * 1000) / 10;
}

export function loadPilotEvalPassRate(): number {
  return computePilotEvalPassRate(runPilotGate());
}
