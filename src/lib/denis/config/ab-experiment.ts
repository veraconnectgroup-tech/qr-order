import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type AbExperimentMetric =
  | "conversion_rate"
  | "avg_order_value"
  | "upsell_accept_rate"
  | "time_to_first_order";

export type AbExperimentStatus = "running" | "completed" | "stopped";

export type AbExperiment = {
  id: string;
  metric: AbExperimentMetric;
  variantA: PartialConciergeConfig;
  variantB: PartialConciergeConfig;
  trafficSplit: number;
  minSessions: number;
  autoApply: boolean;
  ownerApprovedApply: boolean;
  startedAt: string;
  status: AbExperimentStatus;
};

export type AbSessionMetrics = {
  sessionToken: string;
  converted: boolean;
  orderValueCents: number;
  upsellAccepted: boolean;
  minutesToFirstOrder: number | null;
};

export type AbExperimentResult = {
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
const BAYES_MONTE_CARLO_SAMPLES = 12_000;

const METRIC_HIGHER_IS_BETTER: Record<AbExperimentMetric, boolean> = {
  conversion_rate: true,
  avg_order_value: true,
  upsell_accept_rate: true,
  time_to_first_order: false,
};

/** FNV-1a hash → stable bucket in [0, 999]. */
export function hashSessionExperimentBucket(
  sessionId: string,
  experimentId: string
): number {
  const input = `${sessionId}${experimentId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1000;
}

/** Deterministic variant: hash(session_id + experiment_id) % 1000 vs traffic split. */
export function assignAbVariant(
  experiment: Pick<AbExperiment, "id" | "trafficSplit">,
  sessionId: string
): "A" | "B" {
  const bucket = hashSessionExperimentBucket(sessionId, experiment.id);
  const splitThreshold = Math.round(experiment.trafficSplit * 1000);
  return bucket < splitThreshold ? "A" : "B";
}

export function aggregateAbMetric(
  metric: AbExperimentMetric,
  sessions: AbSessionMetrics[]
): number {
  if (sessions.length === 0) return 0;

  switch (metric) {
    case "conversion_rate":
      return sessions.filter((row) => row.converted).length / sessions.length;
    case "avg_order_value": {
      const withOrders = sessions.filter((row) => row.orderValueCents > 0);
      if (withOrders.length === 0) return 0;
      return (
        withOrders.reduce((sum, row) => sum + row.orderValueCents, 0) /
        withOrders.length
      );
    }
    case "upsell_accept_rate":
      return sessions.filter((row) => row.upsellAccepted).length / sessions.length;
    case "time_to_first_order": {
      const withTime = sessions.filter((row) => row.minutesToFirstOrder != null);
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

function computeLift(
  metric: AbExperimentMetric,
  baseline: number,
  challenger: number
): number {
  if (METRIC_HIGHER_IS_BETTER[metric]) {
    if (baseline === 0) return challenger > 0 ? 1 : 0;
    return (challenger - baseline) / baseline;
  }

  if (baseline === 0) return challenger < 0 ? 1 : 0;
  return (baseline - challenger) / baseline;
}

function metricIsBetter(
  metric: AbExperimentMetric,
  valueA: number,
  valueB: number
): boolean {
  return METRIC_HIGHER_IS_BETTER[metric] ? valueB > valueA : valueB < valueA;
}

function metricIsWorse(
  metric: AbExperimentMetric,
  valueA: number,
  valueB: number
): boolean {
  return METRIC_HIGHER_IS_BETTER[metric] ? valueB < valueA : valueB > valueA;
}

/** Bayesian winner after min_sessions — Beta-Binomial or Normal Monte Carlo. */
export function evaluateAbExperiment(
  experiment: AbExperiment,
  sessionsA: AbSessionMetrics[],
  sessionsB: AbSessionMetrics[]
): AbExperimentResult {
  const metricA = aggregateAbMetric(experiment.metric, sessionsA);
  const metricB = aggregateAbMetric(experiment.metric, sessionsB);
  const lift = computeLift(experiment.metric, metricA, metricB);

  const minPerVariant = Math.max(
    experiment.minSessions,
    MIN_SESSIONS_PER_VARIANT
  );
  const hasEnoughData =
    sessionsA.length >= minPerVariant && sessionsB.length >= minPerVariant;
  const sessionsRemaining = Math.max(
    0,
    minPerVariant * 2 - (sessionsA.length + sessionsB.length)
  );

  const confidence = hasEnoughData
    ? bayesianWinProbability(experiment.metric, sessionsA, sessionsB)
    : 0;

  let winner: AbExperimentResult["winner"] = "inconclusive";
  if (hasEnoughData && confidence >= AUTO_APPLY_CONFIDENCE) {
    if (metricIsBetter(experiment.metric, metricA, metricB)) {
      winner = "B";
    } else if (metricIsWorse(experiment.metric, metricA, metricB)) {
      winner = "A";
    }
  } else if (hasEnoughData && confidence >= 0.8) {
    const threshold = METRIC_HIGHER_IS_BETTER[experiment.metric] ? 1.02 : 0.98;
    if (
      METRIC_HIGHER_IS_BETTER[experiment.metric]
        ? metricB > metricA * threshold
        : metricB < metricA * threshold
    ) {
      winner = "B";
    } else if (
      METRIC_HIGHER_IS_BETTER[experiment.metric]
        ? metricA > metricB * threshold
        : metricA < metricB * threshold
    ) {
      winner = "A";
    }
  }

  return {
    experimentId: experiment.id,
    variantAMetric: metricA,
    variantBMetric: metricB,
    lift,
    confidence,
    winner,
    recommendation: buildRecommendation({
      experiment,
      winner,
      lift,
      confidence,
      hasEnoughData,
      sessionsRemaining,
      metricA,
      metricB,
    }),
    sessionsA: sessionsA.length,
    sessionsB: sessionsB.length,
    sessionsRemaining,
  };
}

export function canAutoApplyAbWinner(
  experiment: Pick<AbExperiment, "autoApply" | "ownerApprovedApply">,
  result: AbExperimentResult
): boolean {
  return (
    experiment.autoApply &&
    experiment.ownerApprovedApply &&
    result.winner !== "inconclusive" &&
    result.confidence >= AUTO_APPLY_CONFIDENCE &&
    result.sessionsRemaining === 0
  );
}

function bayesianWinProbability(
  metric: AbExperimentMetric,
  sessionsA: AbSessionMetrics[],
  sessionsB: AbSessionMetrics[]
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

    return betaBinomialWinProbability(
      successesA,
      sessionsA.length,
      successesB,
      sessionsB.length
    );
  }

  return continuousBayesianWinProbability(
    metric,
    sessionsA,
    sessionsB,
    aggregateAbMetric(metric, sessionsA),
    aggregateAbMetric(metric, sessionsB)
  );
}

function betaBinomialWinProbability(
  successesA: number,
  nA: number,
  successesB: number,
  nB: number
): number {
  const alphaA = 1 + successesA;
  const betaA = 1 + (nA - successesA);
  const alphaB = 1 + successesB;
  const betaB = 1 + (nB - successesB);
  const seed = successesA * 1_000_003 + nA * 997 + successesB * 991 + nB;
  const rng = seededRandom(seed);
  let wins = 0;

  for (let i = 0; i < BAYES_MONTE_CARLO_SAMPLES; i++) {
    const sampleA = sampleBeta(alphaA, betaA, rng);
    const sampleB = sampleBeta(alphaB, betaB, rng);
    if (sampleB > sampleA) wins++;
  }

  return wins / BAYES_MONTE_CARLO_SAMPLES;
}

function continuousBayesianWinProbability(
  metric: AbExperimentMetric,
  sessionsA: AbSessionMetrics[],
  sessionsB: AbSessionMetrics[],
  meanA: number,
  meanB: number
): number {
  const valuesA = sessionsA
    .map((row) => continuousValue(row, metric))
    .filter((value): value is number => value != null);
  const valuesB = sessionsB
    .map((row) => continuousValue(row, metric))
    .filter((value): value is number => value != null);

  if (valuesA.length < 2 || valuesB.length < 2) return 0;

  const stdA = Math.sqrt(variance(valuesA, meanA));
  const stdB = Math.sqrt(variance(valuesB, meanB));
  const seed =
    Math.round(meanA) * 1_000_003 +
    Math.round(meanB) * 997 +
    valuesA.length * 991 +
    valuesB.length;
  const rng = seededRandom(seed);
  let wins = 0;
  const higherIsBetter = METRIC_HIGHER_IS_BETTER[metric];

  for (let i = 0; i < BAYES_MONTE_CARLO_SAMPLES; i++) {
    const sampleA = sampleNormal(meanA, stdA / Math.sqrt(valuesA.length), rng);
    const sampleB = sampleNormal(meanB, stdB / Math.sqrt(valuesB.length), rng);
    if (higherIsBetter ? sampleB > sampleA : sampleB < sampleA) wins++;
  }

  return wins / BAYES_MONTE_CARLO_SAMPLES;
}

function continuousValue(
  row: AbSessionMetrics,
  metric: AbExperimentMetric
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

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function sampleBeta(alpha: number, beta: number, rng: () => number): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, rng) * rng() ** (1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x = 0;
    let v = 0;
    while (v <= 0) {
      x = sampleStandardNormal(rng);
      v = 1 + c * x;
    }
    v = v ** 3;
    const u = rng();
    if (u < 1 - 0.0331 * (x ** 4)) return d * v;
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleStandardNormal(rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleNormal(mean: number, stdDev: number, rng: () => number): number {
  return mean + sampleStandardNormal(rng) * stdDev;
}

function buildRecommendation(input: {
  experiment: AbExperiment;
  winner: AbExperimentResult["winner"];
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

function formatMetric(value: number, metric: AbExperimentMetric): string {
  if (metric === "conversion_rate" || metric === "upsell_accept_rate") {
    return `${Math.round(value * 100)}%`;
  }
  if (metric === "avg_order_value") {
    return `${Math.round(value / 100)}`;
  }
  return `${Math.round(value)} min`;
}

export const AB_EXPERIMENT_CONSTANTS = {
  MIN_SESSIONS_PER_VARIANT,
  AUTO_APPLY_CONFIDENCE,
} as const;
