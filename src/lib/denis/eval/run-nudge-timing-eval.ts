import { pickProactiveCandidate } from "@/lib/denis/cognition/proactive/pick-proactive-candidate";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  NUDGE_TIMING_GAP_SCENARIO,
  NUDGE_TIMING_ORDER,
  NUDGE_TIMING_SCENARIOS,
  buildNudgeTimingMental,
  NUDGE_TIMING_EVAL_NOW as NOW,
  type NudgeTimingScenario,
} from "@/lib/denis/eval/fixtures/nudge-timing/scenarios";

const RANK_MESSAGES = {
  browse: "browse",
  dessert: "Da vam donesem naš dezert dana?",
  slowKitchen: "slow",
  guestWelcome: "welcome",
  browseFollowUp: "follow up",
  billPrompt: "bill",
  orderDelay: "delay",
  popularityPair: "pair",
};

function enforceConfig() {
  return {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    mentalModel: {
      ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
      mode: "enforce" as const,
    },
  };
}

export type NudgeTimingResult = {
  id: string;
  description: string;
  passed: boolean;
  errors: string[];
  candidateKind: string | null;
  policyReason: string | null;
};

function runOne(scenario: NudgeTimingScenario): NudgeTimingResult {
  const mental = buildNudgeTimingMental(scenario);
  const pick = pickProactiveCandidate({
    config: enforceConfig(),
    orders: [NUDGE_TIMING_ORDER],
    mental,
    payload: {
      sessionPhase: "settling",
      dismissedNudgeKeys: [],
      hasSessionOrders: true,
    },
    messages: RANK_MESSAGES,
    now: NOW,
  });

  const gotDessert = pick.candidate?.kind === "dessert_nudge";
  const errors: string[] = [];
  if (gotDessert !== scenario.expectDessertNudge) {
    errors.push(
      `expected dessert_nudge=${scenario.expectDessertNudge}, got candidate=${pick.candidate?.kind ?? "null"} (policyTrace reason=${pick.policyTrace?.reason ?? "none"})`
    );
  }

  return {
    id: scenario.id,
    description: scenario.description,
    passed: errors.length === 0,
    errors,
    candidateKind: pick.candidate?.kind ?? null,
    policyReason: pick.policyTrace?.reason ?? null,
  };
}

export type NudgeTimingReport = {
  ok: boolean;
  scenarioCount: number;
  passed: number;
  failed: number;
  results: NudgeTimingResult[];
};

/**
 * Blind-spot eval #4 — proactive nudge TIMING judgment, not threshold math.
 * See fixtures/nudge-timing/scenarios.ts for the full writeup of what's
 * real (the frustration-blocks-upsell gate, exercised end-to-end through
 * the actual pickProactiveCandidate() production entry point with a
 * REAL deriveAffect() call over a realistic guest message) vs. what's an
 * honest, currently-open gap (non-keyword emotional moments — see
 * runNudgeTimingGapScenario below).
 */
export function runNudgeTimingEval(): NudgeTimingReport {
  const results = NUDGE_TIMING_SCENARIOS.map(runOne);
  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0 && results.length > 0,
    scenarioCount: results.length,
    passed,
    failed,
    results,
  };
}

/**
 * Runs the documented-gap scenario and returns its raw result WITHOUT
 * folding it into runNudgeTimingEval's pass/fail gate — it documents
 * current (arguably wrong) behavior, not a requirement to enforce.
 */
export function runNudgeTimingGapScenario(): NudgeTimingResult {
  return runOne(NUDGE_TIMING_GAP_SCENARIO);
}
