export type FoldLatencyStatistic = "median" | "p20";

/** Stable fold latency — warmup + median or p20 (eval SLA, not microbench). */
export function measureFoldLatencyMs(
  run: () => void,
  options?: {
    warmupRuns?: number;
    sampleRuns?: number;
    statistic?: FoldLatencyStatistic;
  }
): number {
  const warmupRuns = options?.warmupRuns ?? 2;
  const sampleRuns = options?.sampleRuns ?? 5;
  const statistic = options?.statistic ?? "median";

  for (let i = 0; i < warmupRuns; i++) {
    run();
  }

  const samples: number[] = [];
  for (let i = 0; i < sampleRuns; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }

  samples.sort((a, b) => a - b);
  if (statistic === "p20") {
    return samples[Math.floor(samples.length * 0.2)] ?? samples[0] ?? 0;
  }
  return samples[Math.floor(samples.length / 2)] ?? samples[0] ?? 0;
}

export function foldLatencySlaError(input: {
  ms: number;
  slaMs: number;
  rows: number;
  label: string;
  statistic?: FoldLatencyStatistic;
}): string | null {
  if (input.ms >= input.slaMs) {
    const statLabel = input.statistic === "p20" ? "p20" : "median";
    return `${input.label}: expected <${input.slaMs}ms on ${input.rows} rows, got ${input.ms.toFixed(2)}ms (${statLabel})`;
  }
  return null;
}
