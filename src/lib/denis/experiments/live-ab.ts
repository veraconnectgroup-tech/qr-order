import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  AB_EXPERIMENT_CONSTANTS,
  aggregateAbMetric,
  assignAbVariant,
  evaluateAbExperiment,
  type AbExperiment,
  type AbExperimentMetric,
  type AbExperimentResult,
  type AbSessionMetrics,
} from "@/lib/denis/config/ab-experiment";

export type ExperimentMetric = AbExperimentMetric;

export type Experiment = Omit<AbExperiment, "autoApply" | "ownerApprovedApply">;

export type SessionMetrics = AbSessionMetrics;

export type ExperimentResult = AbExperimentResult;

/** Deterministic variant assignment — stable per experiment + session. */
export function assignSessionVariant(
  experiment: Experiment,
  sessionToken: string
): "A" | "B" {
  return assignAbVariant(experiment, sessionToken);
}

export function evaluateExperiment(
  experiment: Experiment,
  sessionsA: SessionMetrics[],
  sessionsB: SessionMetrics[]
): ExperimentResult {
  return evaluateAbExperiment(
    {
      ...experiment,
      autoApply: false,
      ownerApprovedApply: false,
    },
    sessionsA,
    sessionsB
  );
}

export function formatExperimentStatusLine(
  name: string,
  result: ExperimentResult,
  variantALabel: string,
  variantBLabel: string
): string {
  const total = result.sessionsA + result.sessionsB;
  const target = result.sessionsA + result.sessionsB + result.sessionsRemaining;
  const liftPct = Math.round(result.lift * 100);
  const confPct = Math.round(result.confidence * 100);
  const leader = result.variantBMetric > result.variantAMetric ? "B" : "A";
  const leaderLift = leader === "B" ? liftPct : -liftPct;

  if (result.sessionsRemaining > 0) {
    return (
      `EXPERIMENT: "${name}"\n` +
      `Variant A: ${variantALabel}\n` +
      `Variant B: ${variantBLabel}\n` +
      `Status: ${total}/${target} sesija | ${leader} ${leaderLift >= 0 ? "+" : ""}${leaderLift}% ${metricShortLabel(result)} | ${confPct}% confidence\n` +
      `→ Još ${result.sessionsRemaining} sesije do zaključka`
    );
  }

  return (
    `EXPERIMENT: "${name}" — ${result.winner === "inconclusive" ? "bez jasnog pobednika" : `pobednik ${result.winner}`}\n` +
    `A: ${variantALabel} · B: ${variantBLabel}\n` +
    `${result.recommendation}`
  );
}

function metricShortLabel(result: ExperimentResult): string {
  if (result.variantAMetric <= 1 && result.variantBMetric <= 1) {
    return "conversion";
  }
  return "metric";
}

export { aggregateAbMetric as aggregateMetric };

export const LIVE_AB_CONSTANTS = AB_EXPERIMENT_CONSTANTS;

export type { PartialConciergeConfig };
