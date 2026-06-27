import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  assignSessionVariant,
  evaluateExperiment,
  LIVE_AB_CONSTANTS,
  type Experiment as LiveExperiment,
  type ExperimentMetric,
  type ExperimentResult as LiveExperimentResult,
  type SessionMetrics,
} from "@/lib/denis/experiments/live-ab";

export type AbExperimentStatus =
  | "draft"
  | "running"
  | "completed"
  | "cancelled";

export type AbPrimaryMetric =
  | "conversion_rate"
  | "avg_order_value"
  | "turns_to_order";

export type AbAssignmentKey = "session" | "guest" | "table";

export type AbExperiment = {
  id: string;
  name: string;
  description: string;
  status: AbExperimentStatus;
  startDate: string;
  endDate?: string;
  variants: {
    control: { config: PartialConciergeConfig };
    treatment: { config: PartialConciergeConfig };
  };
  splitPercent: number;
  assignmentKey: AbAssignmentKey;
  primaryMetric: AbPrimaryMetric;
  secondaryMetrics: string[];
  results?: AbExperimentResults;
};

export type AbExperimentResults = {
  controlSessions: number;
  treatmentSessions: number;
  controlMetric: number;
  treatmentMetric: number;
  lift: number;
  pValue: number;
  significant: boolean;
};

const MAX_DURATION_DAYS = 30;
const SIGNIFICANCE_P = 0.05;

function hashKey(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic assignment — same key always gets the same variant. */
export function assignExperimentVariant(
  experiment: Pick<AbExperiment, "id" | "splitPercent">,
  key: string
): "control" | "treatment" {
  const bucket = hashKey(`${experiment.id}:${key}`) % 100;
  return bucket < experiment.splitPercent ? "treatment" : "control";
}

export function liveMetricFromPrimary(
  metric: AbPrimaryMetric
): ExperimentMetric {
  if (metric === "turns_to_order") return "time_to_first_order";
  return metric;
}

export function toLiveExperiment(experiment: AbExperiment): LiveExperiment {
  return {
    id: experiment.id,
    metric: liveMetricFromPrimary(experiment.primaryMetric),
    variantA: experiment.variants.control.config,
    variantB: experiment.variants.treatment.config,
    trafficSplit: experiment.splitPercent / 100,
    minSessions: LIVE_AB_CONSTANTS.MIN_SESSIONS_PER_VARIANT,
    startedAt: experiment.startDate,
    status:
      experiment.status === "running"
        ? "running"
        : experiment.status === "cancelled"
          ? "stopped"
          : "completed",
  };
}

export function assignExperimentVariantFromLive(
  experiment: LiveExperiment,
  key: string
): "control" | "treatment" {
  const variant = assignSessionVariant(experiment, key);
  return variant === "A" ? "control" : "treatment";
}

export function confidenceToPValue(confidence: number): number {
  return Math.max(0, Math.min(1, 1 - confidence));
}

export function evaluateAbExperiment(
  experiment: AbExperiment,
  controlSessions: SessionMetrics[],
  treatmentSessions: SessionMetrics[]
): AbExperimentResults {
  const live = toLiveExperiment(experiment);
  const result = evaluateExperiment(live, controlSessions, treatmentSessions);
  const pValue = confidenceToPValue(result.confidence);

  return {
    controlSessions: result.sessionsA,
    treatmentSessions: result.sessionsB,
    controlMetric: result.variantAMetric,
    treatmentMetric: result.variantBMetric,
    lift: result.lift,
    pValue,
    significant: pValue < SIGNIFICANCE_P,
  };
}

export function shouldAutoStopExperiment(
  experiment: AbExperiment,
  results: AbExperimentResults,
  now = new Date()
): boolean {
  if (experiment.status !== "running") return false;

  if (results.significant) return true;

  const started = new Date(experiment.startDate);
  const ageDays =
    (now.getTime() - started.getTime()) / (86_400_000);
  if (ageDays >= MAX_DURATION_DAYS) return true;

  if (experiment.endDate && new Date(experiment.endDate) <= now) {
    return true;
  }

  return false;
}

export function mergeExperimentConfigOverlay(
  base: PartialConciergeConfig,
  experiment: AbExperiment,
  variant: "control" | "treatment"
): PartialConciergeConfig {
  const patch =
    variant === "treatment"
      ? experiment.variants.treatment.config
      : experiment.variants.control.config;
  return { ...base, ...patch };
}

export function formatAbExperimentSummary(
  experiment: AbExperiment,
  results: AbExperimentResults
): string {
  const liftPct = Math.round(results.lift * 100);
  const sig = results.significant ? "✓ significant" : "not significant";
  return (
    `${experiment.name}: control ${Math.round(results.controlMetric * (results.controlMetric <= 1 ? 100 : 1))}${results.controlMetric <= 1 ? "%" : ""} · ` +
    `treatment ${Math.round(results.treatmentMetric * (results.treatmentMetric <= 1 ? 100 : 1))}${results.treatmentMetric <= 1 ? "%" : ""} · ` +
    `lift ${liftPct >= 0 ? "+" : ""}${liftPct}% · p=${results.pValue.toFixed(3)} ${sig}`
  );
}

export type { LiveExperimentResult, SessionMetrics };
export { LIVE_AB_CONSTANTS, SIGNIFICANCE_P, MAX_DURATION_DAYS };
