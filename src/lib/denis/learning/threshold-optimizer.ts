import type { ThresholdNudgeOutcome } from "@/lib/denis/platform/threshold-optimizer-types";

export type NudgeOutcome = ThresholdNudgeOutcome;

export type ThresholdMetric = {
  key: string;
  currentValue: number;
  optimalValue: number;
  conversionAtCurrent: number;
  conversionAtOptimal: number;
  sampleSize: number;
  confidence: number;
};

export type ThresholdConversionBucket = {
  bucketId: string;
  label: string;
  representativeMinutes: number;
  sampleSize: number;
  conversionRate: number;
  eligible: boolean;
};

export type ThresholdConversionSeries = {
  key: string;
  label: string;
  currentValue: number;
  buckets: ThresholdConversionBucket[];
};

export type ThresholdBounds = {
  min: number;
  max: number;
};

export const THRESHOLD_CONFIG_KEYS = {
  browseNudgeMinutes: "browseNudgeMinutes",
  dessertDelayMinutes: "dessertDelayMinutes",
  billPromptMinutes: "billPromptMinutes",
  slowKitchenThresholdMinutes: "slowKitchenThresholdMinutes",
} as const;

export const THRESHOLD_BOUNDS: Record<string, ThresholdBounds> = {
  browseNudgeMinutes: { min: 1, max: 10 },
  billPromptMinutes: { min: 5, max: 30 },
  dessertDelayMinutes: { min: 3, max: 30 },
  slowKitchenThresholdMinutes: { min: 5, max: 120 },
};

const MIN_SAMPLES_PER_BUCKET = 50;
const SUGGEST_CONFIDENCE = 0.9;

const NUDGE_KIND_TO_THRESHOLD_KEY: Record<string, string> = {
  browse_nudge: THRESHOLD_CONFIG_KEYS.browseNudgeMinutes,
  dessert_nudge: THRESHOLD_CONFIG_KEYS.dessertDelayMinutes,
  bill_prompt: THRESHOLD_CONFIG_KEYS.billPromptMinutes,
  slow_kitchen: THRESHOLD_CONFIG_KEYS.slowKitchenThresholdMinutes,
};

export const THRESHOLD_KEY_LABELS: Record<string, string> = {
  browseNudgeMinutes: "Browse nudge",
  dessertDelayMinutes: "Desert predlog",
  billPromptMinutes: "Ponuda računa",
  slowKitchenThresholdMinutes: "Kuhinja kasni",
};

type TimingBucket = {
  id: string;
  representative: number;
  min: number;
  max: number;
};

const TIMING_BUCKETS: TimingBucket[] = [
  { id: "1-2", representative: 1, min: 1, max: 2 },
  { id: "2-3", representative: 2, min: 2, max: 3 },
  { id: "3-5", representative: 3, min: 3, max: 5 },
  { id: "5+", representative: 5, min: 5, max: Infinity },
];

function bucketForTiming(minutes: number): TimingBucket | null {
  for (const bucket of TIMING_BUCKETS) {
    if (minutes >= bucket.min && minutes < bucket.max) return bucket;
  }
  return null;
}

/** Wilson score lower bound — conservative conversion confidence (M3). */
export function wilsonLowerBound(successes: number, total: number, z = 1.645): number {
  if (total <= 0) return 0;
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return Math.max(0, (center - margin) / denom);
}

function clampThreshold(key: string, value: number): number {
  const bounds = THRESHOLD_BOUNDS[key];
  if (!bounds) return Math.round(value);
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, value)));
}

function conversionRate(outcomes: NudgeOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const accepted = outcomes.filter((row) => row.outcome === "accepted").length;
  return accepted / outcomes.length;
}

/** One-tailed confidence that bucket A beats bucket B (two-proportion z-test). */
function bucketBeatConfidence(
  successesA: number,
  totalA: number,
  successesB: number,
  totalB: number
): number {
  if (totalA === 0 || totalB === 0) return 0;
  const pA = successesA / totalA;
  const pB = successesB / totalB;
  const pooled = (successesA + successesB) / (totalA + totalB);
  if (pooled <= 0 || pooled >= 1) return 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
  if (se === 0) return 0;
  const z = (pA - pB) / se;
  return z <= 0 ? 0 : normalCdf(z);
}

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

function optimizeKey(
  key: string,
  outcomes: NudgeOutcome[],
  currentValue: number
): ThresholdMetric | null {
  const bucketStats = bucketStatsForKey(outcomes);

  const eligible = [...bucketStats.values()].filter(
    (row) => row.outcomes.length >= MIN_SAMPLES_PER_BUCKET
  );
  if (eligible.length === 0) return null;

  eligible.sort(
    (a, b) => conversionRate(b.outcomes) - conversionRate(a.outcomes)
  );
  const best = eligible[0]!;
  const optimalValue = clampThreshold(key, best.bucket.representative);

  const currentBucket = bucketForTiming(currentValue);
  const currentOutcomes = currentBucket
    ? (bucketStats.get(currentBucket.id)?.outcomes ?? [])
    : [];
  const conversionAtCurrent =
    currentOutcomes.length >= MIN_SAMPLES_PER_BUCKET
      ? conversionRate(currentOutcomes)
      : conversionRate(outcomes);
  const conversionAtOptimal = conversionRate(best.outcomes);

  const bestSuccesses = best.outcomes.filter((row) => row.outcome === "accepted").length;
  const currentSuccesses = currentOutcomes.filter(
    (row) => row.outcome === "accepted"
  ).length;
  const confidence =
    currentOutcomes.length >= MIN_SAMPLES_PER_BUCKET
      ? bucketBeatConfidence(
          bestSuccesses,
          best.outcomes.length,
          currentSuccesses,
          currentOutcomes.length
        )
      : wilsonLowerBound(bestSuccesses, best.outcomes.length);

  return {
    key,
    currentValue,
    optimalValue,
    conversionAtCurrent,
    conversionAtOptimal,
    sampleSize: best.outcomes.length,
    confidence,
  };
}

export function optimizeThresholds(input: {
  nudgeOutcomes: NudgeOutcome[];
  lookbackDays: number;
  currentThresholds: Record<string, number>;
}): ThresholdMetric[] {
  void input.lookbackDays;

  const byKey = new Map<string, NudgeOutcome[]>();
  for (const outcome of input.nudgeOutcomes) {
    const key = NUDGE_KIND_TO_THRESHOLD_KEY[outcome.nudgeKind];
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(outcome);
    byKey.set(key, list);
  }

  const metrics: ThresholdMetric[] = [];
  for (const [key, outcomes] of byKey.entries()) {
    const currentValue = input.currentThresholds[key];
    if (typeof currentValue !== "number") continue;
    const metric = optimizeKey(key, outcomes, currentValue);
    if (metric) metrics.push(metric);
  }

  return metrics.sort((a, b) => b.confidence - a.confidence);
}

export function suggestThresholdChanges(
  metrics: ThresholdMetric[]
): ThresholdMetric[] {
  return metrics.filter(
    (row) =>
      row.confidence >= SUGGEST_CONFIDENCE &&
      row.sampleSize >= MIN_SAMPLES_PER_BUCKET &&
      row.optimalValue !== row.currentValue
  );
}

export function formatThresholdOwnerSuggestion(metric: ThresholdMetric): string {
  const label = THRESHOLD_KEY_LABELS[metric.key] ?? metric.key;
  const optimalPct = Math.round(metric.conversionAtOptimal * 100);
  const currentPct = Math.round(metric.conversionAtCurrent * 100);
  return `${label} na ${metric.optimalValue}min ima ${optimalPct}% konverziju vs ${currentPct}% na ${metric.currentValue}min`;
}

function bucketStatsForKey(outcomes: NudgeOutcome[]): Map<
  string,
  { bucket: TimingBucket; outcomes: NudgeOutcome[] }
> {
  const bucketStats = new Map<
    string,
    { bucket: TimingBucket; outcomes: NudgeOutcome[] }
  >();

  for (const outcome of outcomes) {
    const bucket = bucketForTiming(outcome.timingMinutes);
    if (!bucket) continue;
    const entry = bucketStats.get(bucket.id) ?? { bucket, outcomes: [] };
    entry.outcomes.push(outcome);
    bucketStats.set(bucket.id, entry);
  }

  return bucketStats;
}

/** Per-bucket conversion series for dashboard charts (M3). */
export function buildThresholdConversionSeries(input: {
  nudgeOutcomes: NudgeOutcome[];
  currentThresholds: Record<string, number>;
}): ThresholdConversionSeries[] {
  const byKey = new Map<string, NudgeOutcome[]>();
  for (const outcome of input.nudgeOutcomes) {
    const key = NUDGE_KIND_TO_THRESHOLD_KEY[outcome.nudgeKind];
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(outcome);
    byKey.set(key, list);
  }

  const series: ThresholdConversionSeries[] = [];
  for (const [key, outcomes] of byKey.entries()) {
    const currentValue = input.currentThresholds[key];
    if (typeof currentValue !== "number") continue;

    const bucketStats = bucketStatsForKey(outcomes);
    const buckets = TIMING_BUCKETS.map((bucket) => {
      const row = bucketStats.get(bucket.id);
      const sampleSize = row?.outcomes.length ?? 0;
      return {
        bucketId: bucket.id,
        label: `${bucket.representative}min`,
        representativeMinutes: bucket.representative,
        sampleSize,
        conversionRate: sampleSize > 0 ? conversionRate(row!.outcomes) : 0,
        eligible: sampleSize >= MIN_SAMPLES_PER_BUCKET,
      };
    });

    series.push({
      key,
      label: THRESHOLD_KEY_LABELS[key] ?? key,
      currentValue,
      buckets,
    });
  }

  return series.sort((a, b) => a.label.localeCompare(b.label));
}

export function formatThresholdDigestSection(metrics: ThresholdMetric[]): string[] {
  if (metrics.length === 0) return [];

  const lines = ["TIMING OPTIMIZACIJA:"];
  for (const row of metrics) {
    if (row.optimalValue === row.currentValue) {
      lines.push(
        `- ${row.key}: trenutno ${row.currentValue}min, OK (peak konverzija)`
      );
      continue;
    }
    lines.push(`- ${formatThresholdOwnerSuggestion(row)}`);
  }

  const changes = suggestThresholdChanges(metrics);
  if (changes.length > 0) {
    lines.push(
      `Preporuka: ${changes
        .map((row) => `podesi ${row.key} na ${row.optimalValue} min`)
        .join(" i ")}`
    );
  }

  return lines;
}

export function buildThresholdRecommendationSummary(
  metrics: ThresholdMetric[]
): string | null {
  const changes = suggestThresholdChanges(metrics);
  if (changes.length === 0) return null;
  return changes.map((row) => formatThresholdOwnerSuggestion(row)).join(" · ");
}

export const THRESHOLD_OPTIMIZER_CONSTANTS = {
  MIN_SAMPLES_PER_BUCKET,
  SUGGEST_CONFIDENCE,
} as const;
