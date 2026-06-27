import { DENIS_EVAL_SCENARIOS } from "@/lib/denis/eval/fixtures/scenarios";
import { runPilotGate } from "@/lib/denis/eval/run-pilot-gate";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";

export type EvalBaseline = {
  waiterParity: number;
  anticipation: number;
  reflexAccuracy: number;
  recordedAt?: string;
};

export type GateThresholds = {
  waiterParity: number;
  anticipation: number;
  reflexAccuracy: number;
};

export const EVAL_GATE_THRESHOLDS: GateThresholds = {
  waiterParity: 0.99,
  anticipation: 0.95,
  reflexAccuracy: 0.98,
};

function computeReflexAccuracy(): number {
  const reflexScenarios = DENIS_EVAL_SCENARIOS.filter(
    (scenario) => scenario.expect.usedT0 === true
  );
  if (reflexScenarios.length === 0) return 1;
  const passed = reflexScenarios.filter((s) => runDenisScenario(s).passed).length;
  return passed / reflexScenarios.length;
}

export function runFullEvalMetrics() {
  const gate = runPilotGate();
  return {
    waiterParity: gate.waiterParity.passRate,
    anticipation: gate.anticipation.passRate,
    reflexAccuracy: computeReflexAccuracy(),
  };
}

export function compareEvalToBaseline(
  baseline: EvalBaseline,
  current: ReturnType<typeof runFullEvalMetrics>
) {
  return {
    waiterParity: {
      baseline: baseline.waiterParity,
      current: current.waiterParity,
      delta: current.waiterParity - baseline.waiterParity,
      pass: current.waiterParity >= EVAL_GATE_THRESHOLDS.waiterParity,
    },
    anticipation: {
      baseline: baseline.anticipation,
      current: current.anticipation,
      delta: current.anticipation - baseline.anticipation,
      pass: current.anticipation >= EVAL_GATE_THRESHOLDS.anticipation,
    },
    reflexAccuracy: {
      baseline: baseline.reflexAccuracy,
      current: current.reflexAccuracy,
      delta: current.reflexAccuracy - baseline.reflexAccuracy,
      pass: current.reflexAccuracy >= EVAL_GATE_THRESHOLDS.reflexAccuracy,
    },
  };
}

export function evalGatePassed(
  baseline: EvalBaseline,
  current: ReturnType<typeof runFullEvalMetrics> = runFullEvalMetrics()
): boolean {
  const comparison = compareEvalToBaseline(baseline, current);
  return Object.values(comparison).every((row) => row.pass);
}
