import { appendProductionEdgeCasesFromLearnings } from "@/lib/denis/eval/fixtures/production-edge-case-store";
import {
  extractSessionLearnings,
  type ExtractedLearning,
  type SessionEvalMetrics,
} from "@/lib/denis/eval/learning-extractor";
import {
  evaluatePromptAbTest,
  generateEvolvedPromptSection,
  PROMPT_LEARNING_THRESHOLD,
  selectPromptWinner,
  type PromptAbEvalResult,
} from "@/lib/denis/eval/prompt-evolver";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import { loadProductionEdgeCases } from "@/lib/denis/eval/fixtures/production-edge-case-store";
import {
  appendAccumulatedLearnings,
  loadAccumulatedLearnings,
  statusFromAbResult,
} from "@/lib/denis/eval/prompt-evolution-store";
import {
  persistPromptEvolutionStatus,
  type PromptEvolutionStatus,
} from "@/lib/denis/knowledge/evolved-learnings-store";
import type { DenisEvalScenario, EvalSuiteReport } from "@/lib/denis/eval/types";
import {
  extractConversationMessages,
  type ConversationMessage,
} from "@/lib/denis/monitoring/loop-detection";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

export const SESSION_QUALITY_ANOMALY_THRESHOLD = 0.65;

export type SessionQualityScores = {
  comprehension: number;
  accuracy: number;
  tone: number;
  upsellSuccess: number;
  overall: number;
};

export type SessionEvalResult = {
  sessionId: string;
  locationId?: string;
  scores: SessionQualityScores;
  learnings: ExtractedLearning[];
  anomaly: boolean;
  evaluatedAt: string;
};

export type WeeklyQualityReport = {
  weekKey: string;
  currentWeekAvg: number;
  previousWeekAvg: number;
  trendDelta: number;
  topFailurePatterns: Array<{ kind: ExtractedLearning["kind"]; count: number }>;
  suggestedPromptImprovements: string[];
  sessionCount: number;
};

export type ContinuousEvalLoopResult = SessionEvalResult & {
  edgeCasesAppended: number;
  promptEvolution: {
    ready: boolean;
    abResult: PromptAbEvalResult | null;
    winner: ReturnType<typeof selectPromptWinner>;
  };
};

function weekKeyFromDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

function sessionEvalKey(sessionId: string): string {
  return `denis:session-eval:${sessionId}`;
}

function weeklyBucketKey(weekKey: string): string {
  return `denis:session-eval:week:${weekKey}`;
}

const SESSION_EVAL_TTL_SEC = 120 * 24 * 3_600;

export function scoreSessionQuality(
  learnings: ExtractedLearning[],
  metrics: SessionEvalMetrics
): SessionQualityScores {
  const turns = Math.max(metrics.turnCount, 1);
  const mismatches = learnings.filter((row) => row.kind === "mismatch").length;
  const corrections = learnings.filter((row) => row.kind === "correction").length;
  const waiterFailures = learnings.filter(
    (row) => row.kind === "waiter_failure"
  ).length;
  const reinforcements = learnings.filter(
    (row) => row.kind === "reinforcement"
  ).length;

  const comprehension = Math.max(0, 1 - mismatches / turns);
  const accuracy = Math.max(0, 1 - (corrections + mismatches) / turns);
  const tone = Math.max(0, 1 - waiterFailures / turns);
  const upsellSuccess = metrics.upsellOffered
    ? metrics.upsellAccepted
      ? 1
      : 0.35
    : 0.7;

  const overall =
    comprehension * 0.35 +
    accuracy * 0.3 +
    tone * 0.2 +
    upsellSuccess * 0.15;

  if (reinforcements > 0 && corrections === 0 && mismatches === 0) {
    return {
      comprehension: Math.min(1, comprehension + 0.05),
      accuracy: Math.min(1, accuracy + 0.05),
      tone,
      upsellSuccess,
      overall: Math.min(1, overall + 0.04),
    };
  }

  return { comprehension, accuracy, tone, upsellSuccess, overall };
}

export function runProductionEdgeEvalSuite(
  scenarios: DenisEvalScenario[]
): EvalSuiteReport {
  const results = scenarios.map((scenario) => runDenisScenario(scenario));
  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0,
    scenarioCount: results.length,
    passed,
    failed,
    results,
    shadowParityThreshold: 0.99,
  };
}

export async function persistSessionEvalResult(
  result: SessionEvalResult
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(sessionEvalKey(result.sessionId), result, {
      ex: SESSION_EVAL_TTL_SEC,
    });
    await redis.rpush(weeklyBucketKey(weekKeyFromDate(result.evaluatedAt)), {
      sessionId: result.sessionId,
      overall: result.scores.overall,
      learnings: result.learnings,
    });
    await redis.expire(
      weeklyBucketKey(weekKeyFromDate(result.evaluatedAt)),
      SESSION_EVAL_TTL_SEC
    );
  } catch (error) {
    logRedisDegradation("denis.session_eval.persist", error);
  }
}

/**
 * 2026-07-12 — the writer side of this key already existed
 * (persistSessionEvalResult, wired to every real guest session via
 * session-eval.ts's outbox handler); nothing read it back per-session
 * until now. Lets the admin-facing session list/replay surface the
 * SAME mismatch/correction/waiter_failure learnings already computed
 * post-session, instead of only ever seeing them folded into the
 * weekly aggregate report.
 */
export async function loadSessionEvalResult(
  sessionId: string
): Promise<SessionEvalResult | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get<SessionEvalResult>(sessionEvalKey(sessionId));
  } catch (error) {
    logRedisDegradation("denis.session_eval.read", error);
    return null;
  }
}

export async function buildWeeklyQualityReport(
  referenceDate = new Date()
): Promise<WeeklyQualityReport> {
  const redis = getRedisClient();
  const currentWeek = weekKeyFromDate(referenceDate.toISOString());
  const previousMonday = new Date(currentWeek);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  const previousWeek = weekKeyFromDate(previousMonday.toISOString());

  const empty: WeeklyQualityReport = {
    weekKey: currentWeek,
    currentWeekAvg: 0,
    previousWeekAvg: 0,
    trendDelta: 0,
    topFailurePatterns: [],
    suggestedPromptImprovements: [],
    sessionCount: 0,
  };

  if (!redis) return empty;

  try {
    const [currentRows, previousRows] = await Promise.all([
      redis.lrange<{ overall: number; learnings: ExtractedLearning[] }>(
        weeklyBucketKey(currentWeek),
        0,
        -1
      ),
      redis.lrange<{ overall: number }>(weeklyBucketKey(previousWeek), 0, -1),
    ]);

    const current = currentRows ?? [];
    const previous = previousRows ?? [];

    const currentWeekAvg = current.length
      ? current.reduce((sum, row) => sum + (row.overall ?? 0), 0) / current.length
      : 0;
    const previousWeekAvg = previous.length
      ? previous.reduce((sum, row) => sum + (row.overall ?? 0), 0) / previous.length
      : 0;

    const failureCounts = new Map<ExtractedLearning["kind"], number>();
    for (const row of current) {
      for (const learning of row.learnings ?? []) {
        if (learning.kind === "reinforcement") continue;
        failureCounts.set(
          learning.kind,
          (failureCounts.get(learning.kind) ?? 0) + 1
        );
      }
    }

    const topFailurePatterns = [...failureCounts.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const suggestedPromptImprovements = topFailurePatterns.map((row) => {
      switch (row.kind) {
        case "mismatch":
          return "Add explicit comprehension checks before upsell when guest uses product-specific language.";
        case "correction":
          return "Shorten confirmations and mirror guest wording before cart mutations.";
        case "waiter_failure":
          return "Offer human handoff earlier when guest repeats the same request.";
        case "tool_loop_issue":
          return "Investigate agentic tool-loop round-cap hits / tool errors in shadow traces before widening canary.";
        default:
          return "Review recent session transcripts for recurring failure patterns.";
      }
    });

    return {
      weekKey: currentWeek,
      currentWeekAvg,
      previousWeekAvg,
      trendDelta: currentWeekAvg - previousWeekAvg,
      topFailurePatterns,
      suggestedPromptImprovements,
      sessionCount: current.length,
    };
  } catch (error) {
    logRedisDegradation("denis.session_eval.weekly_report", error);
    return empty;
  }
}

export async function runContinuousEvalLoop(input: {
  sessionId: string;
  locationId?: string;
  timeline: DenisTimelineRow[];
  messages?: ConversationMessage[];
  metrics: SessionEvalMetrics;
  accumulatedLearnings?: ExtractedLearning[];
  baselinePromptSection?: string;
}): Promise<ContinuousEvalLoopResult> {
  const messages =
    input.messages ?? extractConversationMessages(input.timeline);
  const learnings = extractSessionLearnings({
    sessionId: input.sessionId,
    locationId: input.locationId,
    messages,
    timeline: input.timeline,
  });

  const scores = scoreSessionQuality(learnings, input.metrics);
  const evaluatedAt = new Date().toISOString();
  const sessionEval: SessionEvalResult = {
    sessionId: input.sessionId,
    locationId: input.locationId,
    scores,
    learnings,
    anomaly: scores.overall < SESSION_QUALITY_ANOMALY_THRESHOLD,
    evaluatedAt,
  };

  await persistSessionEvalResult(sessionEval);
  const edgeCasesAppended =
    await appendProductionEdgeCasesFromLearnings(learnings);

  const allLearnings = [
    ...(input.accumulatedLearnings ?? []),
    ...learnings,
  ];

  const evolvedSection = generateEvolvedPromptSection(allLearnings);
  let abResult: PromptAbEvalResult | null = null;
  let winner: ReturnType<typeof selectPromptWinner> = "hold";

  if (evolvedSection) {
    const edgeScenarios = await loadProductionEdgeCases();
    abResult = evaluatePromptAbTest({
      baselineSection: input.baselinePromptSection ?? "",
      evolvedSection,
      learnings: allLearnings,
      edgeScenarios,
    });
    winner = selectPromptWinner(abResult);
  }

  return {
    ...sessionEval,
    edgeCasesAppended,
    promptEvolution: {
      ready: allLearnings.length >= PROMPT_LEARNING_THRESHOLD,
      abResult,
      winner,
    },
  };
}

/** Post-session entry — evaluate immediately after session closes. */
export async function runPostSessionEval(input: {
  sessionId: string;
  locationId?: string;
  aiSessionId?: string | null;
  timeline?: DenisTimelineRow[];
  messages?: ConversationMessage[];
  metrics?: Partial<SessionEvalMetrics>;
}): Promise<SessionEvalResult> {
  const timeline = input.timeline ?? [];
  const messages =
    input.messages ?? extractConversationMessages(timeline);
  const turnCount = messages.filter((row) => row.role === "guest").length;

  const learnings = extractSessionLearnings({
    sessionId: input.sessionId,
    locationId: input.locationId,
    messages,
    timeline,
  });

  const metrics: SessionEvalMetrics = {
    turnCount,
    upsellOffered: input.metrics?.upsellOffered ?? false,
    upsellAccepted: input.metrics?.upsellAccepted ?? false,
    handoffAfterDenis: learnings.some((row) => row.kind === "waiter_failure"),
    ordersCount: input.metrics?.ordersCount ?? 0,
  };

  const scores = scoreSessionQuality(learnings, metrics);
  const result: SessionEvalResult = {
    sessionId: input.sessionId,
    locationId: input.locationId,
    scores,
    learnings,
    anomaly: scores.overall < SESSION_QUALITY_ANOMALY_THRESHOLD,
    evaluatedAt: new Date().toISOString(),
  };

  await persistSessionEvalResult(result);
  await appendProductionEdgeCasesFromLearnings(learnings);

  return result;
}

/**
 * Prompt-evolution flywheel, run in shadow mode after a session's own eval
 * is already scored (reuses that session's learnings — does not re-score or
 * re-persist the session, avoiding double-counting in the weekly bucket).
 *
 * Pools learnings across sessions for this location (Redis, prompt-evolution-store.ts),
 * and once enough have accumulated, generates + A/B-evaluates a candidate
 * evolved prompt section against production edge cases. The result is only
 * ever persisted as a *status* for admin review — nothing here touches the
 * live system prompt. Never throws — a failure here must never affect the
 * (already-succeeded) session eval it runs after.
 */
export async function runPromptEvolutionShadow(input: {
  locationId: string;
  sessionLearnings: ExtractedLearning[];
}): Promise<PromptEvolutionStatus | null> {
  try {
    const previous = await loadAccumulatedLearnings(input.locationId);
    const allLearnings = [...previous, ...input.sessionLearnings];

    const evolvedSection = generateEvolvedPromptSection(allLearnings);
    let abResult: PromptAbEvalResult | null = null;

    if (evolvedSection) {
      const edgeScenarios = await loadProductionEdgeCases();
      abResult = evaluatePromptAbTest({
        baselineSection: "",
        evolvedSection,
        learnings: allLearnings,
        edgeScenarios,
      });
    }

    await appendAccumulatedLearnings(input.locationId, input.sessionLearnings);

    const status = statusFromAbResult({
      locationId: input.locationId,
      learningCount: allLearnings.length,
      abResult,
      evolvedSection,
    });
    await persistPromptEvolutionStatus(status);
    return status;
  } catch (error) {
    logRedisDegradation("denis.eval.prompt_evolution.shadow", error);
    return null;
  }
}
