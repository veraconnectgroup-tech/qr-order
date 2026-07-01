/** Lightweight live metrics — no LLM calls. */
export type DenisHealthMetrics = {
  uptimePercent: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  refusalRate: number;
  /** Denis repeated same reply 3+ times (from loop detection — S2). */
  loopDetectionCount: number;
  /** Share of turns that used T0 reflex vs LLM. */
  t0HitRate: number;
  /** OpenAI timeout/error share of LLM attempts. */
  llmErrorRate: number;
  creditBurnRatePerHour: number;
  activeSessionCount: number;
  /** Sessions without response > 30s. */
  stuckSessions: string[];
};

export type HealthStatus = "healthy" | "degraded" | "critical";

export type AutoAction =
  | { type: "skip_upsell" }
  | { type: "staff_alert"; message: string }
  | { type: "t0_only" }
  | { type: "owner_email"; subject: string; body: string }
  | { type: "reduce_proactive_frequency" }
  | { type: "gradual_feature_restore" };

export type DenisHealthContract = {
  refusalRateMax: number;
};

export const DEFAULT_DENIS_HEALTH_CONTRACT: DenisHealthContract = {
  refusalRateMax: 0,
};

export const HEALTH_RESPONSE_HEALTHY_MS = 3_000;
export const HEALTH_RESPONSE_DEGRADED_MS = 8_000;
export const HEALTH_REFUSAL_DEGRADED_RATE = 0.01;
export const HEALTH_REFUSAL_CRITICAL_RATE = 0.05;
export const HEALTH_LLM_ERROR_CRITICAL_RATE = 0.1;
export const HEALTH_STUCK_SESSION_MS = 30_000;
export const HEALTH_DEGRADED_PROACTIVE_MS = 5 * 60_000;

export type DenisHealthEvaluation = {
  status: HealthStatus;
  issues: string[];
  autoActions: AutoAction[];
};

function pushIssue(issues: string[], message: string): void {
  if (!issues.includes(message)) issues.push(message);
}

/**
 * Evaluate Denis live health and derive self-healing actions.
 * Offline eval contract informs refusal baseline; live thresholds are fixed.
 */
export function evaluateDenisHealth(
  metrics: DenisHealthMetrics,
  contract: DenisHealthContract = DEFAULT_DENIS_HEALTH_CONTRACT
): DenisHealthEvaluation {
  const issues: string[] = [];
  const autoActions: AutoAction[] = [];

  let status: HealthStatus = "healthy";

  const responseCritical = metrics.avgResponseMs > HEALTH_RESPONSE_DEGRADED_MS;
  const responseDegraded =
    metrics.avgResponseMs >= HEALTH_RESPONSE_HEALTHY_MS &&
    metrics.avgResponseMs <= HEALTH_RESPONSE_DEGRADED_MS;
  const refusalAboveContract = metrics.refusalRate > contract.refusalRateMax;
  const refusalDegraded = metrics.refusalRate > HEALTH_REFUSAL_DEGRADED_RATE;
  const refusalCritical = metrics.refusalRate > HEALTH_REFUSAL_CRITICAL_RATE;
  const llmErrorCritical =
    metrics.llmErrorRate > HEALTH_LLM_ERROR_CRITICAL_RATE;
  const hasLoops = metrics.loopDetectionCount > 0;
  const hasStuck = metrics.stuckSessions.length > 0;

  if (responseCritical) {
    pushIssue(
      issues,
      `avg response ${metrics.avgResponseMs}ms > ${HEALTH_RESPONSE_DEGRADED_MS}ms`
    );
  } else if (responseDegraded) {
    pushIssue(
      issues,
      `avg response ${metrics.avgResponseMs}ms elevated (${HEALTH_RESPONSE_HEALTHY_MS}–${HEALTH_RESPONSE_DEGRADED_MS}ms)`
    );
  }

  if (refusalAboveContract) {
    pushIssue(
      issues,
      `refusal rate ${(metrics.refusalRate * 100).toFixed(1)}% > contract max ${(contract.refusalRateMax * 100).toFixed(0)}%`
    );
  }

  if (hasLoops) {
    pushIssue(issues, `${metrics.loopDetectionCount} conversation loop(s) detected`);
  }

  if (hasStuck) {
    pushIssue(
      issues,
      `${metrics.stuckSessions.length} stuck session(s) (>${HEALTH_STUCK_SESSION_MS / 1000}s)`
    );
  }

  if (llmErrorCritical) {
    pushIssue(
      issues,
      `LLM error rate ${(metrics.llmErrorRate * 100).toFixed(1)}% > ${(HEALTH_LLM_ERROR_CRITICAL_RATE * 100).toFixed(0)}%`
    );
  }

  // Critical: response > 8s OR refusal > 5% OR llm errors > 10%
  if (responseCritical || refusalCritical || llmErrorCritical) {
    status = "critical";
    autoActions.push({ type: "t0_only" });
    autoActions.push({
      type: "staff_alert",
      message: "Denis na minimalnom modu — samo osnovno naručivanje.",
    });
    autoActions.push({
      type: "owner_email",
      subject: "Denis critical health alert",
      body: `Denis entered critical mode. Issues: ${issues.join("; ")}`,
    });
    autoActions.push({ type: "skip_upsell" });
    return { status, issues, autoActions };
  }

  // Degraded: response 3–8s OR refusal > 1% OR loops OR stuck sessions
  if (
    responseDegraded ||
    refusalDegraded ||
    hasLoops ||
    hasStuck ||
    (refusalAboveContract && !refusalCritical)
  ) {
    status = "degraded";
    autoActions.push({ type: "skip_upsell" });
    autoActions.push({
      type: "staff_alert",
      message: "Denis usporen — moguće duže čekanje.",
    });
    if (hasStuck || responseDegraded) {
      autoActions.push({ type: "reduce_proactive_frequency" });
    }
    return { status, issues, autoActions };
  }

  return { status, issues, autoActions };
}

export type HealthOpsPatch = {
  skipUpsell: boolean;
  shortenReplies: boolean;
  guestSafeStaffHint: string | null;
};

export function buildHealthOpsPatch(
  evaluation: DenisHealthEvaluation
): HealthOpsPatch {
  const skipFromHealth = evaluation.autoActions.some(
    (action) => action.type === "skip_upsell"
  );
  const staffAlert = evaluation.autoActions.find(
    (action): action is Extract<AutoAction, { type: "staff_alert" }> =>
      action.type === "staff_alert"
  );

  return {
    skipUpsell: skipFromHealth,
    shortenReplies: evaluation.status !== "healthy",
    guestSafeStaffHint: staffAlert?.message ?? null,
  };
}

export function shouldForceT0Only(evaluation: DenisHealthEvaluation): boolean {
  return evaluation.autoActions.some((action) => action.type === "t0_only");
}

export function shouldReduceProactiveFrequency(
  evaluation: DenisHealthEvaluation
): boolean {
  return evaluation.autoActions.some(
    (action) => action.type === "reduce_proactive_frequency"
  );
}

export function aggregateTurnSamples(
  samples: Array<{
    ts: number;
    latencyMs: number;
    llmUsed: boolean;
    llmError: boolean;
    refusal: boolean;
    credits: number;
  }>
): Pick<
  DenisHealthMetrics,
  | "avgResponseMs"
  | "p95ResponseMs"
  | "refusalRate"
  | "t0HitRate"
  | "llmErrorRate"
  | "creditBurnRatePerHour"
> {
  if (!samples.length) {
    return {
      avgResponseMs: 0,
      p95ResponseMs: 0,
      refusalRate: 0,
      t0HitRate: 1,
      llmErrorRate: 0,
      creditBurnRatePerHour: 0,
    };
  }

  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const avgResponseMs = Math.round(
    latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length
  );
  const p95Index = Math.min(
    latencies.length - 1,
    Math.ceil(latencies.length * 0.95) - 1
  );
  const p95ResponseMs = latencies[p95Index] ?? 0;

  const llmSamples = samples.filter((s) => s.llmUsed);
  const llmErrors = llmSamples.filter((s) => s.llmError).length;
  const refusals = samples.filter((s) => s.refusal).length;
  const t0Hits = samples.filter((s) => !s.llmUsed).length;
  const totalCredits = samples.reduce((sum, s) => sum + s.credits, 0);

  const spanMs =
    samples.length >= 2
      ? Math.max(
          samples[samples.length - 1]!.ts - samples[0]!.ts,
          60_000
        )
      : 3_600_000;

  return {
    avgResponseMs,
    p95ResponseMs,
    refusalRate: refusals / samples.length,
    t0HitRate: t0Hits / samples.length,
    llmErrorRate: llmSamples.length ? llmErrors / llmSamples.length : 0,
    creditBurnRatePerHour: Math.round((totalCredits / spanMs) * 3_600_000),
  };
}

export type HealthTurnSample = {
  ts: number;
  latencyMs: number;
  llmUsed: boolean;
  llmError: boolean;
  refusal: boolean;
  credits: number;
  sessionId: string;
};
