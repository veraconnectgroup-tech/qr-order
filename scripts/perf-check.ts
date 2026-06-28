/**
 * Performance budget CI check — eval fold SLAs + static budgets.
 * Usage: pnpm perf:check
 */
import { PERFORMANCE_BUDGETS } from "@/lib/performance/budgets";
import { runMentalModelSuite } from "@/lib/denis/eval/run-mental-model-fixture";
import { runOfferFoldSuite } from "@/lib/denis/eval/run-offer-fold-fixture";

type CheckResult = { name: string; pass: boolean; detail: string };

function main() {
  const checks: CheckResult[] = [];

  const mental = runMentalModelSuite();
  checks.push({
    name: "mentalModelFoldP500",
    pass: mental.foldMsP500 < PERFORMANCE_BUDGETS.foldPerformance.p500MaxMs,
    detail: `${mental.foldMsP500.toFixed(2)}ms (max ${PERFORMANCE_BUDGETS.foldPerformance.p500MaxMs}ms)`,
  });

  const offer = runOfferFoldSuite();
  checks.push({
    name: "offerFoldP500",
    pass: offer.foldMsP500 < PERFORMANCE_BUDGETS.foldPerformance.p500MaxMs,
    detail: `${offer.foldMsP500.toFixed(2)}ms (max ${PERFORMANCE_BUDGETS.foldPerformance.p500MaxMs}ms)`,
  });

  console.log("=== PERFORMANCE BUDGET CHECK ===\n");
  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? "✅" : "❌";
    console.log(`${icon} ${check.name}: ${check.detail}`);
    if (!check.pass) allPass = false;
  }

  console.log("\n📦 Guest bundle budget:", `${PERFORMANCE_BUDGETS.guestBundleSize.maxKb}KB gzip (run ANALYZE=true pnpm build locally)`);
  console.log("⏱️ Denis turn budgets: T0 ≤", PERFORMANCE_BUDGETS.t0ReflexLatency.p95MaxMs, "ms p95");

  if (!allPass) {
    console.error("\n🚫 PERFORMANCE CHECK FAILED");
    process.exit(1);
  }
  console.log("\n✅ PERFORMANCE CHECK PASSED");
}

main();
