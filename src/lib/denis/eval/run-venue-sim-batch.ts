import {
  buildVenueSimDeploySessions,
  VENUE_SIM_SESSION_TARGET,
} from "@/lib/denis/eval/fixtures/venue-sim/deploy-sessions";
import { runAnticipationScenario } from "@/lib/denis/eval/run-anticipation-eval";
import {
  runWaiterParityScenario,
  WAITER_PARITY_MIN_PASS_RATE,
} from "@/lib/denis/eval/run-waiter-parity";
import type { VenueSimDeploySession } from "@/lib/denis/eval/fixtures/venue-sim/deploy-sessions";

export const VENUE_SIM_MIN_OVERALL_SCORE = 0.85;

export type VenueSimSessionDimensionScores = {
  comprehension: number;
  orderingAccuracy: number;
  upsellRate: number;
  language: number;
};

export type VenueSimSessionResult = {
  sessionId: string;
  persona: VenueSimDeploySession["persona"];
  language: VenueSimDeploySession["language"];
  kind: VenueSimDeploySession["kind"];
  passed: boolean;
  scores: VenueSimSessionDimensionScores;
  errors: string[];
};

export type VenueSimDeployReport = {
  ok: boolean;
  sessionCount: number;
  passed: number;
  failed: number;
  overallScore: number;
  minOverallScore: number;
  dimensions: VenueSimSessionDimensionScores;
  orderingPassRate: number;
  proactivePassRate: number;
  results: VenueSimSessionResult[];
};

function mean(values: number[]): number {
  if (!values.length) return 1;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isUpsellCandidate(scenario: VenueSimDeploySession): boolean {
  if (scenario.kind !== "proactive" || !scenario.proactive) return false;
  const kind = scenario.proactive.expect.kind;
  return (
    scenario.proactive.expect.emit === true &&
    (kind === "dessert_nudge" ||
      kind === "popularity_pair" ||
      kind === "drink_pairing" ||
      kind === "browse_nudge" ||
      kind === "bill_prompt")
  );
}

function scoreOrderingSession(
  session: VenueSimDeploySession
): VenueSimSessionResult {
  const ordering = session.ordering!;
  const result = runWaiterParityScenario(ordering);
  const passed = result.passed ? 1 : 0;
  const hasLanguagePath = Boolean(ordering.sessionLanguage);

  return {
    sessionId: session.id,
    persona: session.persona,
    language: session.language,
    kind: "ordering",
    passed: result.passed,
    scores: {
      comprehension: passed,
      orderingAccuracy: passed,
      upsellRate: 1,
      language: hasLanguagePath ? passed : 1,
    },
    errors: result.errors,
  };
}

function scoreProactiveSession(
  session: VenueSimDeploySession
): VenueSimSessionResult {
  const proactive = session.proactive!;
  const result = runAnticipationScenario(proactive);
  const passed = result.passed ? 1 : 0;
  const upsellCandidate = isUpsellCandidate(session);

  return {
    sessionId: session.id,
    persona: session.persona,
    language: session.language,
    kind: "proactive",
    passed: result.passed,
    scores: {
      comprehension: passed,
      orderingAccuracy: 1,
      upsellRate: upsellCandidate ? passed : 1,
      language: passed,
    },
    errors: result.errors,
  };
}

function scoreSession(session: VenueSimDeploySession): VenueSimSessionResult {
  if (session.kind === "ordering" && session.ordering) {
    return scoreOrderingSession(session);
  }
  if (session.kind === "proactive" && session.proactive) {
    return scoreProactiveSession(session);
  }
  return {
    sessionId: session.id,
    persona: session.persona,
    language: session.language,
    kind: session.kind,
    passed: false,
    scores: {
      comprehension: 0,
      orderingAccuracy: 0,
      upsellRate: 0,
      language: 0,
    },
    errors: ["session missing ordering or proactive fixture"],
  };
}

/** Pre-deploy venue sim — 100 sessions scored on comprehension, ordering, upsell, language. */
export function runVenueSimDeployGate(): VenueSimDeployReport {
  const sessions = buildVenueSimDeploySessions();
  const results = sessions.map(scoreSession);

  const dimensions: VenueSimSessionDimensionScores = {
    comprehension: mean(results.map((row) => row.scores.comprehension)),
    orderingAccuracy: mean(results.map((row) => row.scores.orderingAccuracy)),
    upsellRate: mean(results.map((row) => row.scores.upsellRate)),
    language: mean(results.map((row) => row.scores.language)),
  };

  const overallScore = mean([
    dimensions.comprehension,
    dimensions.orderingAccuracy,
    dimensions.upsellRate,
    dimensions.language,
  ]);

  const orderingResults = results.filter((row) => row.kind === "ordering");
  const proactiveResults = results.filter((row) => row.kind === "proactive");
  const orderingPassRate = mean(orderingResults.map((row) => (row.passed ? 1 : 0)));
  const proactivePassRate = mean(proactiveResults.map((row) => (row.passed ? 1 : 0)));
  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;

  return {
    ok:
      sessions.length === VENUE_SIM_SESSION_TARGET &&
      overallScore >= VENUE_SIM_MIN_OVERALL_SCORE &&
      orderingPassRate >= WAITER_PARITY_MIN_PASS_RATE,
    sessionCount: sessions.length,
    passed,
    failed,
    overallScore,
    minOverallScore: VENUE_SIM_MIN_OVERALL_SCORE,
    dimensions,
    orderingPassRate,
    proactivePassRate,
    results,
  };
}

/** Exported for unit tests — score a single deploy session. */
export function runVenueSimDeploySession(
  session: VenueSimDeploySession
): VenueSimSessionResult {
  return scoreSession(session);
}
