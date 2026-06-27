import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type ExperimentMetric =
  | "conversion_rate"
  | "avg_order_value"
  | "upsell_accept_rate"
  | "time_to_first_order";

export type Experiment = {
  id: string;
  metric: ExperimentMetric;
  variantA: PartialConciergeConfig;
  variantB: PartialConciergeConfig;
  trafficSplit: number;
  minSessions: number;
  startedAt: string;
  status: "running" | "completed" | "stopped";
};

export type SessionMetrics = {
  sessionToken: string;
  converted: boolean;
  orderValueCents: number;
  upsellAccepted: boolean;
  minutesToFirstOrder: number | null;
};

export type ExperimentResult = {
  experimentId: string;
  variantAMetric: number;
  variantBMetric: number;
  lift: number;
  confidence: number;
  winner: "A" | "B" | "inconclusive";
  recommendation: string;
  sessionsA: number;
  sessionsB: number;
  sessionsRemaining: number;
};

const MIN_SESSIONS_PER_VARIANT = 100;
const AUTO_APPLY_CONFIDENCE = 0.95;

/** Deterministic variant assignment — stable per experiment + session. */
export function assignSessionVariant(
  experiment: Experiment,
  sessionToken: string
): "A" | "B" {
  const bucket = hashToUnit(`${experiment.id}:${sessionToken}`);
  return bucket < experiment.trafficSplit ? "A" : "B";
}

export function evaluateExperiment(
  experiment: Experiment,
  sessionsA: SessionMetrics[],
  sessionsB: SessionMetrics[]
): ExperimentResult {
  const metricA = aggregateMetric(experiment.metric, sessionsA);
  const metricB = aggregateMetric(experiment.metric, sessionsB);
  const lift = computeLift(metricA, metricB);
  const confidence = computeConfidence(
    experiment.metric,
    sessionsA,
    sessionsB,
    metricA,
    metricB
  );

  const minPerVariant = Math.max(experiment.minSessions, MIN_SESSIONS_PER_VARIANT);
  const hasEnoughData =
    sessionsA.length >= minPerVariant && sessionsB.length >= minPerVariant;
  const sessionsRemaining = Math.max(
    0,
    minPerVariant * 2 - (sessionsA.length + sessionsB.length)
  );

  let winner: ExperimentResult["winner"] = "inconclusive";
  if (hasEnoughData && confidence >= AUTO_APPLY_CONFIDENCE) {
    if (metricB > metricA) winner = "B";
    else if (metricA > metricB) winner = "A";
  } else if (hasEnoughData && confidence >= 0.8) {
    if (metricB > metricA * 1.02) winner = "B";
    else if (metricA > metricB * 1.02) winner = "A";
  }

  const recommendation = buildRecommendation({
    experiment,
    winner,
    lift,
    confidence,
    hasEnoughData,
    sessionsRemaining,
    metricA,
    metricB,
  });

  return {
    experimentId: experiment.id,
    variantAMetric: metricA,
    variantBMetric: metricB,
    lift,
    confidence,
    winner,
    recommendation,
    sessionsA: sessionsA.length,
    sessionsB: sessionsB.length,
    sessionsRemaining,
  };
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
  const leader =
    result.variantBMetric > result.variantAMetric ? "B" : "A";
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

function hashToUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function aggregateMetric(metric: ExperimentMetric, sessions: SessionMetrics[]): number {
  if (sessions.length === 0) return 0;

  switch (metric) {
    case "conversion_rate":
      return (
        sessions.filter((row) => row.converted).length / sessions.length
      );
    case "avg_order_value": {
      const withOrders = sessions.filter((row) => row.orderValueCents > 0);
      if (withOrders.length === 0) return 0;
      return (
        withOrders.reduce((sum, row) => sum + row.orderValueCents, 0) /
        withOrders.length
      );
    }
    case "upsell_accept_rate":
      return (
        sessions.filter((row) => row.upsellAccepted).length / sessions.length
      );
    case "time_to_first_order": {
      const withTime = sessions.filter(
        (row) => row.minutesToFirstOrder != null
      );
      if (withTime.length === 0) return 0;
      return (
        withTime.reduce((sum, row) => sum + (row.minutesToFirstOrder ?? 0), 0) /
        withTime.length
      );
    }
    default:
      return 0;
  }
}

function computeLift(baseline: number, challenger: number): number {
  if (baseline === 0) {
    return challenger > 0 ? 1 : 0;
  }
  return (challenger - baseline) / baseline;
}

function computeConfidence(
  metric: ExperimentMetric,
  sessionsA: SessionMetrics[],
  sessionsB: SessionMetrics[],
  valueA: number,
  valueB: number
): number {
  if (sessionsA.length === 0 || sessionsB.length === 0) return 0;

  if (metric === "conversion_rate" || metric === "upsell_accept_rate") {
    const successesA =
      metric === "conversion_rate"
        ? sessionsA.filter((row) => row.converted).length
        : sessionsA.filter((row) => row.upsellAccepted).length;
    const successesB =
      metric === "conversion_rate"
        ? sessionsB.filter((row) => row.converted).length
        : sessionsB.filter((row) => row.upsellAccepted).length;
    return proportionConfidence(
      successesA / sessionsA.length,
      sessionsA.length,
      successesB / sessionsB.length,
      sessionsB.length
    );
  }

  return continuousConfidence(sessionsA, sessionsB, valueA, valueB, metric);
}

/** One-tailed confidence that B differs from A (standard two-proportion z-test). */
function proportionConfidence(
  pA: number,
  nA: number,
  pB: number,
  nB: number
): number {
  if (nA === 0 || nB === 0) return 0;
  const pooled = (pA * nA + pB * nB) / (nA + nB);
  if (pooled <= 0 || pooled >= 1) return 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return 0;
  const z = Math.abs(pB - pA) / se;
  return normalCdf(z);
}

function continuousConfidence(
  sessionsA: SessionMetrics[],
  sessionsB: SessionMetrics[],
  valueA: number,
  valueB: number,
  metric: ExperimentMetric
): number {
  const valuesA = sessionsA
    .map((row) => continuousValue(row, metric))
    .filter((value): value is number => value != null);
  const valuesB = sessionsB
    .map((row) => continuousValue(row, metric))
    .filter((value): value is number => value != null);

  if (valuesA.length < 2 || valuesB.length < 2) return 0;

  const meanA = valueA;
  const meanB = valueB;
  const varA = variance(valuesA, meanA);
  const varB = variance(valuesB, meanB);
  const se = Math.sqrt(varA / valuesA.length + varB / valuesB.length);
  if (se === 0) return 0;
  const z = Math.abs(meanB - meanA) / se;
  return normalCdf(z);
}

function continuousValue(
  row: SessionMetrics,
  metric: ExperimentMetric
): number | null {
  if (metric === "avg_order_value") {
    return row.orderValueCents > 0 ? row.orderValueCents : null;
  }
  if (metric === "time_to_first_order") {
    return row.minutesToFirstOrder;
  }
  return null;
}

function variance(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  return (
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1)
  );
}

/** Standard normal CDF approximation (Abramowitz & Stegun). */
function normalCdf(z: number): number {
  const x = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - p : p;
}

function buildRecommendation(input: {
  experiment: Experiment;
  winner: ExperimentResult["winner"];
  lift: number;
  confidence: number;
  hasEnoughData: boolean;
  sessionsRemaining: number;
  metricA: number;
  metricB: number;
}): string {
  const liftPct = Math.round(input.lift * 100);
  const confPct = Math.round(input.confidence * 100);

  if (input.sessionsRemaining > 0) {
    return `Prikupljamo podatke — još ${input.sessionsRemaining} sesija do validnog zaključka.`;
  }

  if (input.winner === "inconclusive") {
    return `Nema statistički značajne razlike (A=${formatMetric(input.metricA, input.experiment.metric)}, B=${formatMetric(input.metricB, input.experiment.metric)}, ${confPct}% confidence).`;
  }

  if (input.winner === "B") {
    return `Variant B pobedjuje sa +${liftPct}% (${confPct}% confidence). Preporuka: primeni variant B.`;
  }

  return `Variant A ostaje bolji (+${Math.abs(liftPct)}% vs B, ${confPct}% confidence). Zadrži trenutnu konfiguraciju.`;
}

function formatMetric(value: number, metric: ExperimentMetric): string {
  if (metric === "conversion_rate" || metric === "upsell_accept_rate") {
    return `${Math.round(value * 100)}%`;
  }
  if (metric === "avg_order_value") {
    return `${Math.round(value / 100)}`;
  }
  return `${Math.round(value)} min`;
}

export const LIVE_AB_CONSTANTS = {
  MIN_SESSIONS_PER_VARIANT,
  AUTO_APPLY_CONFIDENCE,
} as const;
