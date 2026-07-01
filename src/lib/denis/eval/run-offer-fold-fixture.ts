import { foldGuestOfferContext } from "@/lib/denis/cognition/offer/fold-guest-offer-context";
import {
  assertOfferExpect,
  buildOfferFoldInput,
  OFFER_FOLD_SCENARIOS,
  type OfferFoldScenario,
} from "@/lib/denis/eval/fixtures/offer/scenarios";
import { browseRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";

import { PERFORMANCE_BUDGETS } from "@/lib/performance/budgets";

export type OfferFoldScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type OfferFoldReport = {
  ok: boolean;
  scenarioCount: number;
  foldMsP500: number;
  results: OfferFoldScenarioResult[];
};

const FOLD_SLA_MS = PERFORMANCE_BUDGETS.foldPerformance.p500MaxMs * 8;
const PERF_TIMELINE_ROWS = 500;

function runScenario(scenario: OfferFoldScenario): OfferFoldScenarioResult {
  const errors: string[] = [];
  const offer = foldGuestOfferContext(buildOfferFoldInput(scenario));

  assertOfferExpect(offer, scenario.expect, errors);

  if (!offer.hash || offer.hash === "empty") {
    errors.push("expected non-empty offer.hash after fold");
  }

  return { id: scenario.id, passed: errors.length === 0, errors };
}

function benchmarkFoldPerformance(): { ms: number; errors: string[] } {
  const errors: string[] = [];
  const timeline = Array.from({ length: PERF_TIMELINE_ROWS }, (_, index) =>
    browseRow(index + 1, {
      action: "view_product",
      productId: `prod-${index}`,
      productName: `Item ${index}`,
      categoryPath: ["food"],
      menuSection: "food",
      dwellMs: 1200,
      timestamp: `2026-06-07T12:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
    })
  );

  const input = buildOfferFoldInput({
    id: "perf",
    description: "perf",
    timeline,
    mentalOverride: {
      predictedNeed: "needs_help_choosing",
      receptiveness: "open",
    },
    expect: {},
  });

  for (let i = 0; i < 3; i++) {
    foldGuestOfferContext(input);
  }

  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const sampleStart = performance.now();
    foldGuestOfferContext(input);
    samples.push(performance.now() - sampleStart);
  }
  const ms = Math.min(...samples);

  if (ms >= FOLD_SLA_MS) {
    errors.push(
      `fold SLA: expected <${FOLD_SLA_MS}ms on ${PERF_TIMELINE_ROWS} rows, got ${ms.toFixed(2)}ms`
    );
  }

  return { ms, errors };
}

/** ADR-038 GMM-9 — guest offer fold eval (shadow, no behavior change). */
export function runOfferFoldSuite(): OfferFoldReport {
  const results = OFFER_FOLD_SCENARIOS.map(runScenario);
  const perf = benchmarkFoldPerformance();

  if (perf.errors.length > 0) {
    results.push({
      id: "offer_fold_performance_p500",
      passed: false,
      errors: perf.errors,
    });
  }

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: OFFER_FOLD_SCENARIOS.length,
    foldMsP500: perf.ms,
    results,
  };
}
