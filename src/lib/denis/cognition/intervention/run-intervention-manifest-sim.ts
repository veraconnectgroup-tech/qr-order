import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";
import { evaluateInterventionPipeline } from "@/lib/denis/cognition/intervention/run-intervention-pipeline";
import type { ProactiveTurnResult } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type InterventionManifestSimScenario = {
  id: string;
  state: TableSessionState;
  proactiveResult: ProactiveTurnResult;
  enforceBlock?: boolean;
  expectDecision: "speak" | "silence" | "defer";
};

export type InterventionManifestSimReport = {
  ok: boolean;
  scenarioCount: number;
  regressions: string[];
  baselineLabel: string;
  proposedLabel: string;
};

/** Deterministic manifest diff sim — fixture corpus replay (ADR-041 P4). */
export function runInterventionManifestCompareSim(input: {
  baseline: InterventionManifest;
  proposed: InterventionManifest;
  scenarios: InterventionManifestSimScenario[];
  baselineLabel?: string;
  proposedLabel?: string;
}): InterventionManifestSimReport {
  const regressions: string[] = [];

  for (const scenario of input.scenarios) {
    const baselineEval = evaluateInterventionPipeline({
      state: scenario.state,
      proactiveResult: scenario.proactiveResult,
      manifest: input.baseline,
      enforceBlock: scenario.enforceBlock,
    });
    const proposedEval = evaluateInterventionPipeline({
      state: scenario.state,
      proactiveResult: scenario.proactiveResult,
      manifest: input.proposed,
      enforceBlock: scenario.enforceBlock,
    });

    if (
      baselineEval.decision === scenario.expectDecision &&
      proposedEval.decision !== scenario.expectDecision
    ) {
      regressions.push(
        `${scenario.id}: expected ${scenario.expectDecision}, proposed=${proposedEval.decision}, baseline=${baselineEval.decision}`
      );
    }
  }

  return {
    ok: regressions.length === 0,
    scenarioCount: input.scenarios.length,
    regressions,
    baselineLabel: input.baselineLabel ?? input.baseline.version,
    proposedLabel: input.proposedLabel ?? input.proposed.version,
  };
}
