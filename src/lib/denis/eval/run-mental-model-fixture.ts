import { gateProactiveNudge } from "@/lib/denis/cognition/mental-model/gate-proactive-nudge";
import { foldGuestMentalModel } from "@/lib/denis/cognition/mental-model/fold-guest-mental-model";
import { foldGuestSignals } from "@/lib/denis/cognition/mental-model/fold-guest-signals";
import { assertMentalModelInvariants } from "@/lib/denis/cognition/mental-model/mental-model-invariants";
import {
  assertMentalModelExpect,
  browseRow,
  buildMentalModelFoldInput,
  MENTAL_MODEL_SCENARIOS,
  type MentalModelScenario,
} from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { foldBrowseProfile } from "@/lib/denis/cognition/browse/fold-browse-profile";

export type MentalModelScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type MentalModelReport = {
  ok: boolean;
  scenarioCount: number;
  foldMsP500: number;
  results: MentalModelScenarioResult[];
};

const FOLD_SLA_MS = 6;
const PERF_TIMELINE_ROWS = 500;

function runScenario(scenario: MentalModelScenario): MentalModelScenarioResult {
  const errors: string[] = [];
  const input = buildMentalModelFoldInput(scenario);
  const model = foldGuestMentalModel(input);
  const spine = foldGuestSignals({
    timeline: scenario.timeline,
    dismissedNudgeKeys: scenario.dismissedNudges ?? [],
  });
  const browse = foldBrowseProfile(scenario.timeline);

  assertMentalModelExpect(model, scenario.expect, errors);
  assertMentalModelInvariants(
    model,
    {
      phase: scenario.phase,
      billSettled: false,
      maxProductCartChurn: spine.maxProductCartChurn,
      cartAbandonedCount: browse.cartAbandoned.length,
    },
    errors
  );

  if (!model.hash || model.hash === "empty") {
    errors.push("expected non-empty mental.hash after fold");
  }
  if (model.confidence <= 0) {
    errors.push(`expected confidence > 0, got ${model.confidence}`);
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

  const input = buildMentalModelFoldInput({
    timeline,
    phase: "browsing",
    flowNodeId: "browse",
  });

  const start = performance.now();
  foldGuestMentalModel(input);
  const ms = performance.now() - start;

  if (ms >= FOLD_SLA_MS) {
    errors.push(`fold SLA: expected <${FOLD_SLA_MS}ms on ${PERF_TIMELINE_ROWS} rows, got ${ms.toFixed(2)}ms`);
  }

  return { ms, errors };
}

function runGateScenario(scenario: MentalModelScenario): MentalModelScenarioResult {
  const errors: string[] = [];
  const input = buildMentalModelFoldInput(scenario);
  const mental = foldGuestMentalModel(input);
  const gate = gateProactiveNudge({
    mental,
    candidate: { kind: "browse_nudge", message: "test" },
    config: input.config,
    now: input.now,
  });

  if (scenario.id === "gmm_closed_blocks_nudge") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked for closed guest");
    if (gate.reason !== "gmm.receptiveness_closed") {
      errors.push(`gate.reason: expected gmm.receptiveness_closed, got ${gate.reason}`);
    }
  }

  if (scenario.id === "gmm_frustrated_escalate") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked for frustrated guest");
    if (gate.reason !== "gmm.frustration_high") {
      errors.push(`gate.reason: expected gmm.frustration_high, got ${gate.reason}`);
    }
  }

  if (scenario.id === "gmm_party_leader_only") {
    if (gate.allow) errors.push("gate: expected browse_nudge blocked for party follower");
    if (gate.reason !== "gmm.group_address_follower") {
      errors.push(
        `gate.reason: expected gmm.group_address_follower, got ${gate.reason}`
      );
    }
  }

  return { id: `${scenario.id}_gate`, passed: errors.length === 0, errors };
}

/** ADR-038 Val B — guest posture fold + spine invariants + gate unit checks. */
export function runMentalModelSuite(): MentalModelReport {
  const results = [
    ...MENTAL_MODEL_SCENARIOS.map(runScenario),
    ...MENTAL_MODEL_SCENARIOS.filter((row) =>
      [
        "gmm_closed_blocks_nudge",
        "gmm_frustrated_escalate",
        "gmm_party_leader_only",
      ].includes(row.id)
    ).map(runGateScenario),
  ];
  const perf = benchmarkFoldPerformance();

  if (perf.errors.length > 0) {
    results.push({
      id: "gmm_fold_performance_p500",
      passed: false,
      errors: perf.errors,
    });
  }

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: MENTAL_MODEL_SCENARIOS.length,
    foldMsP500: perf.ms,
    results,
  };
}
