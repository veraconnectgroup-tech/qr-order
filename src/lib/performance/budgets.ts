/** Performance budgets — enforced by `pnpm perf:check` in CI. */
export const PERFORMANCE_BUDGETS = {
  guestBundleSize: {
    maxKb: 250,
    metric: "gzip" as const,
  },
  firstContentfulPaint: {
    maxMs: 1500,
  },
  largestContentfulPaint: {
    maxMs: 2500,
  },
  t0ReflexLatency: {
    p95MaxMs: 300,
  },
  t1TemplateLatency: {
    p95MaxMs: 500,
  },
  t2PerceiveLatency: {
    p95MaxMs: 2000,
  },
  t3FullLatency: {
    p95MaxMs: 3000,
  },
  queryLatency: {
    p95MaxMs: 50,
  },
  turnDbQueries: {
    max: 15,
  },
  foldPerformance: {
    p500MaxMs: 50,
  },
} as const;

export type PerformanceBudgetKey = keyof typeof PERFORMANCE_BUDGETS;
