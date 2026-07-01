/**
 * CI eval gate CLI — blocks PR if Denis quality metrics drop below thresholds.
 * Usage: pnpm eval:gate | pnpm eval:update-baseline
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function ensureCiEnv() {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "ci-eval-gate-placeholder";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "ci-eval-gate-placeholder";
}

const BASELINE_PATH = resolve(process.cwd(), "eval-baseline.json");

function loadBaseline(): import("@/lib/denis/eval/eval-gate").EvalBaseline {
  const raw = readFileSync(BASELINE_PATH, "utf8");
  return JSON.parse(raw) as import("@/lib/denis/eval/eval-gate").EvalBaseline;
}

function formatTrend(delta: number): string {
  if (delta >= 0) return `↑${delta.toFixed(3)}`;
  return `↓${Math.abs(delta).toFixed(3)}`;
}

async function main() {
  ensureCiEnv();
  const {
    compareEvalToBaseline,
    EVAL_GATE_THRESHOLDS,
    runFullEvalMetrics,
  } = await import("@/lib/denis/eval/eval-gate");

  const update = process.argv.includes("--update-baseline");
  const current = runFullEvalMetrics();

  if (update) {
    const next = {
      ...current,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log("✅ Baseline updated at eval-baseline.json");
    return;
  }

  const baseline = loadBaseline();
  const comparison = compareEvalToBaseline(baseline, current);

  console.log("=== EVAL GATE ===");
  for (const [name, data] of Object.entries(comparison)) {
    const icon = data.pass ? "✅" : "❌";
    const min = EVAL_GATE_THRESHOLDS[name as keyof typeof EVAL_GATE_THRESHOLDS];
    console.log(
      `${icon} ${name}: ${data.current.toFixed(3)} (${formatTrend(data.delta)} vs baseline, min ${min})`
    );
  }

  const allPass = Object.values(comparison).every((row) => row.pass);
  if (!allPass) {
    console.error("\n🚫 EVAL GATE FAILED — PR blocked");
    process.exit(1);
  }

  console.log("\n✅ EVAL GATE PASSED");
}

void main();
