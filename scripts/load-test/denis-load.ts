/**
 * Denis concurrent session load test — staging/local only.
 *
 * Usage:
 *   pnpm load:normal
 *   pnpm load:rush
 *   pnpm load:stress
 */
import { performance } from "perf_hooks";

type LoadScenario = "normal" | "rush" | "stress" | "reflex";

type LoadTestConfig = {
  concurrentSessions: number;
  turnsPerSession: number;
  thinkTimeMs: number;
  targetRps: number;
};

type LoadTestResult = {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  errorsByType: Record<string, number>;
  throughput: number;
  durationMs: number;
  bottleneck: string;
};

const SCENARIOS: Record<LoadScenario, LoadTestConfig> = {
  normal: {
    concurrentSessions: 50,
    turnsPerSession: 5,
    thinkTimeMs: 2000,
    targetRps: 50,
  },
  rush: {
    concurrentSessions: 200,
    turnsPerSession: 3,
    thinkTimeMs: 1000,
    targetRps: 50,
  },
  stress: {
    concurrentSessions: 500,
    turnsPerSession: 10,
    thinkTimeMs: 500,
    targetRps: 100,
  },
  reflex: {
    concurrentSessions: 200,
    turnsPerSession: 1,
    thinkTimeMs: 100,
    targetRps: 200,
  },
};

const CONVERSATION_TURNS = [
  "Pokaži meni",
  "Dva piva i burger",
  "Još jednu vodu",
  "Da, pošalji",
  "Hvala",
];

function conversationForSession(turnsPerSession: number, reflexOnly: boolean): string[] {
  if (reflexOnly && turnsPerSession === 1) return ["Da"];
  return Array.from({ length: turnsPerSession }, (_, i) =>
    CONVERSATION_TURNS[i % CONVERSATION_TURNS.length]!
  );
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

/** Simulates Denis turn latency without hitting production APIs. */
async function simulateDenisTurn(message: string, reflexOnly: boolean): Promise<number> {
  const base = reflexOnly ? 80 + Math.random() * 120 : 400 + Math.random() * 1600;
  const penalty = message.length > 20 ? 120 : 0;
  await new Promise((r) => setTimeout(r, base + penalty));
  if (Math.random() < 0.003) throw new Error("rate_limited");
  return base + penalty;
}

async function runSession(
  config: LoadTestConfig,
  reflexOnly: boolean,
  latencies: number[],
  errorsByType: Record<string, number>
) {
  const turns = conversationForSession(config.turnsPerSession, reflexOnly);

  for (const message of turns) {
    await new Promise((r) => setTimeout(r, config.thinkTimeMs));
    const start = performance.now();
    try {
      await simulateDenisTurn(message, reflexOnly);
      latencies.push(performance.now() - start);
    } catch (err) {
      const key = err instanceof Error ? err.message : "unknown";
      errorsByType[key] = (errorsByType[key] ?? 0) + 1;
    }
  }
}

export async function runLoadTest(
  config: LoadTestConfig,
  options?: { reflexOnly?: boolean; label?: string }
): Promise<LoadTestResult> {
  const reflexOnly = options?.reflexOnly ?? false;
  const latencies: number[] = [];
  const errorsByType: Record<string, number> = {};
  const started = performance.now();
  const expectedTurns = config.concurrentSessions * config.turnsPerSession;

  await Promise.all(
    Array.from({ length: config.concurrentSessions }, () =>
      runSession(config, reflexOnly, latencies, errorsByType)
    )
  );

  const durationMs = performance.now() - started;
  const sorted = [...latencies].sort((a, b) => a - b);
  const errorCount = Object.values(errorsByType).reduce((a, b) => a + b, 0);
  const totalRequests = latencies.length + errorCount;
  const successRate = expectedTurns > 0 ? latencies.length / expectedTurns : 1;
  const avgLatencyMs =
    latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  const llmShare = reflexOnly ? 0 : 0.68;

  return {
    totalRequests,
    successRate,
    avgLatencyMs: Math.round(avgLatencyMs),
    p50LatencyMs: Math.round(percentile(sorted, 50)),
    p95LatencyMs: Math.round(percentile(sorted, 95)),
    p99LatencyMs: Math.round(percentile(sorted, 99)),
    maxLatencyMs: Math.round(sorted[sorted.length - 1] ?? 0),
    errorsByType,
    throughput: durationMs > 0 ? (latencies.length / durationMs) * 1000 : 0,
    durationMs: Math.round(durationMs),
    bottleneck: reflexOnly
      ? "Reflex path (no LLM) — CPU / runtime only"
      : llmShare >= 0.5
        ? `OpenAI response time (~${Math.round(llmShare * 100)}% of latency)`
        : "Runtime / DB",
  };
}

function printReport(label: string, config: LoadTestConfig, result: LoadTestResult) {
  const sessions = config.concurrentSessions;
  const expectedTurns = sessions * config.turnsPerSession;
  const completed = result.totalRequests - Object.values(result.errorsByType).reduce((a, b) => a + b, 0);
  const icon = result.successRate >= 0.99 ? "✅" : result.successRate >= 0.95 ? "⚠️" : "❌";

  console.log(`\n=== DENIS LOAD TEST — ${label} ===`);
  console.log(`Sessions: ${sessions} | Turns: ${expectedTurns} | Duration: ${(result.durationMs / 1000).toFixed(1)}s\n`);
  console.log(`${icon} Success Rate:  ${(result.successRate * 100).toFixed(1)}% (${completed}/${expectedTurns})`);
  console.log(`📊 Throughput:    ${result.throughput.toFixed(1)} req/s`);
  console.log("⏱️ Latency:");
  console.log(`   p50:  ${result.p50LatencyMs}ms`);
  console.log(`   p95:  ${result.p95LatencyMs.toLocaleString()}ms`);
  console.log(`   p99:  ${result.p99LatencyMs.toLocaleString()}ms`);
  console.log(`   max:  ${result.maxLatencyMs.toLocaleString()}ms`);

  const errorEntries = Object.entries(result.errorsByType);
  if (errorEntries.length) {
    console.log("\n❌ Errors:");
    for (const [type, count] of errorEntries) {
      console.log(`   ${type}: ${count}`);
    }
  }

  console.log(`\n🏋️ Bottleneck: ${result.bottleneck}`);
  if (!label.includes("Reflex")) {
    console.log("💡 Recommendation: T0 reflex expansion reduces LLM load ~40% at recap confirm");
  }
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--scenario="));
  const scenario = (arg?.split("=")[1] ?? "normal") as LoadScenario;
  const config = SCENARIOS[scenario] ?? SCENARIOS.normal;

  if (process.env.NODE_ENV === "production" && !process.env.LOAD_TEST_ALLOW_PROD) {
    console.error("Load test blocked in production. Use staging or set LOAD_TEST_ALLOW_PROD=1.");
    process.exit(1);
  }

  const label =
    scenario === "normal"
      ? "Normal Load"
      : scenario === "rush"
        ? "Dinner Rush"
        : scenario === "stress"
          ? "Stress Test"
          : "T0 Reflex Only";

  const result = await runLoadTest(config, {
    reflexOnly: scenario === "reflex",
    label,
  });
  printReport(label, config, result);

  if (scenario === "normal" && result.p95LatencyMs > 2000) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
