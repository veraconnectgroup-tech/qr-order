import { isDenisRefusalReply } from "@/lib/ai/conversation-leadership";
import type { VenueQualityContract } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { DENIS_PILOT_SR_SCENARIOS } from "@/lib/denis/eval/fixtures/pilot-sr-scenarios";
import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import { runWaiterParitySuite } from "@/lib/denis/eval/run-waiter-parity";
import {
  GOLDEN_ASSISTANT_LINES,
  REFUSAL_ASSISTANT_LINES,
} from "@/lib/denis/eval/fixtures/quality-contract/refusal-messages";

export const PLATFORM_QUALITY_CONTRACT: VenueQualityContract = {
  refusalRateMax: 0,
  evalPassMin: 1,
  shadowParityMin: 0.99,
  llmInvocationMax: 0.35,
};

export type QualityContractMetrics = {
  evalPassRate: number;
  pilotSrPassRate: number;
  waiterParityPassRate: number;
  /** Waiter-parity sim — informational; sim exercises LLM paths by design. */
  simLlmInvocationRate: number;
  /** Live timeline aggregate when available — enforced against llmInvocationMax. */
  liveLlmInvocationRate?: number | null;
  refusalDetectionRate: number;
  goldenRefusalRate: number;
  scenarioCount: number;
};

export type QualityContractEvalResult = {
  ok: boolean;
  contract: VenueQualityContract;
  metrics: QualityContractMetrics;
  violations: string[];
};

function measureRefusalDetection(): {
  refusalDetectionRate: number;
  goldenRefusalRate: number;
} {
  let refusalHits = 0;
  for (const line of REFUSAL_ASSISTANT_LINES) {
    if (isDenisRefusalReply(line)) refusalHits += 1;
  }

  let goldenFalsePositives = 0;
  for (const line of GOLDEN_ASSISTANT_LINES) {
    if (isDenisRefusalReply(line)) goldenFalsePositives += 1;
  }

  return {
    refusalDetectionRate: REFUSAL_ASSISTANT_LINES.length
      ? refusalHits / REFUSAL_ASSISTANT_LINES.length
      : 1,
    goldenRefusalRate: GOLDEN_ASSISTANT_LINES.length
      ? goldenFalsePositives / GOLDEN_ASSISTANT_LINES.length
      : 0,
  };
}

function measurePilotSrPassRate(): number {
  if (!DENIS_PILOT_SR_SCENARIOS.length) return 1;
  const passed = DENIS_PILOT_SR_SCENARIOS.filter((scenario) =>
    runDenisScenario(scenario).passed
  ).length;
  return passed / DENIS_PILOT_SR_SCENARIOS.length;
}

function measureLlmInvocationFromWaiterParity(
  report: ReturnType<typeof runWaiterParitySuite>
): number {
  let llmTurns = 0;
  let totalTurns = 0;

  for (const scenario of report.results) {
    for (const turn of scenario.turns) {
      totalTurns += 1;
      if (turn.actual.requiresLlm) llmTurns += 1;
    }
  }

  return totalTurns ? llmTurns / totalTurns : 0;
}

/** ADR-031 C4 / MR-7 — eval-only quality contract gate (no DB). */
export function runQualityContractEval(
  contract: VenueQualityContract | null = PLATFORM_QUALITY_CONTRACT,
  options?: { liveLlmInvocationRate?: number | null }
): QualityContractEvalResult {
  const effective = contract ?? PLATFORM_QUALITY_CONTRACT;
  const core = runDenisEvalSuite();
  const pilotSrPassRate = measurePilotSrPassRate();
  const waiterParity = runWaiterParitySuite();
  const refusal = measureRefusalDetection();

  const metrics: QualityContractMetrics = {
    evalPassRate: core.scenarioCount ? core.passed / core.scenarioCount : 0,
    pilotSrPassRate,
    waiterParityPassRate: waiterParity.passRate,
    simLlmInvocationRate: measureLlmInvocationFromWaiterParity(waiterParity),
    liveLlmInvocationRate: options?.liveLlmInvocationRate,
    refusalDetectionRate: refusal.refusalDetectionRate,
    goldenRefusalRate: refusal.goldenRefusalRate,
    scenarioCount:
      core.scenarioCount +
      DENIS_PILOT_SR_SCENARIOS.length +
      waiterParity.scenarioCount,
  };

  return {
    ok: evaluateQualityContract(effective, metrics).ok,
    contract: effective,
    metrics,
    violations: evaluateQualityContract(effective, metrics).violations,
  };
}

export function evaluateQualityContract(
  contract: VenueQualityContract | null,
  metrics: QualityContractMetrics
): Pick<QualityContractEvalResult, "ok" | "violations"> {
  const effective = contract ?? PLATFORM_QUALITY_CONTRACT;
  const violations: string[] = [];

  const evalPassRate = Math.min(
    metrics.evalPassRate,
    metrics.pilotSrPassRate,
    metrics.waiterParityPassRate
  );
  if (evalPassRate < effective.evalPassMin) {
    violations.push(
      `eval pass ${(evalPassRate * 100).toFixed(1)}% < min ${(effective.evalPassMin * 100).toFixed(0)}%`
    );
  }

  if (metrics.goldenRefusalRate > effective.refusalRateMax) {
    violations.push(
      `golden refusal rate ${(metrics.goldenRefusalRate * 100).toFixed(1)}% > max ${(effective.refusalRateMax * 100).toFixed(0)}%`
    );
  }

  if (metrics.refusalDetectionRate < 1) {
    violations.push(
      `refusal detector missed ${((1 - metrics.refusalDetectionRate) * 100).toFixed(0)}% of fixtures`
    );
  }

  if (
    metrics.liveLlmInvocationRate != null &&
    metrics.liveLlmInvocationRate > effective.llmInvocationMax
  ) {
    violations.push(
      `live llm invocation ${(metrics.liveLlmInvocationRate * 100).toFixed(1)}% > max ${(effective.llmInvocationMax * 100).toFixed(0)}%`
    );
  }

  return { ok: violations.length === 0, violations };
}
