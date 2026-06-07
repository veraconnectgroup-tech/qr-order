import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  evaluateManifestPromoteGate,
  evaluateSimRegression,
} from "@/lib/denis/eval/run-manifest-promote-gate";
import {
  MANIFEST_PROMOTE_GATE_SCENARIOS,
  type ManifestPromoteGateScenario,
} from "@/lib/denis/eval/fixtures/manifest/promote-gate-scenarios";

export type ManifestPromoteGateScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type ManifestPromoteGateFixtureReport = {
  ok: boolean;
  scenarioCount: number;
  results: ManifestPromoteGateScenarioResult[];
};

function runScenario(
  scenario: ManifestPromoteGateScenario
): ManifestPromoteGateScenarioResult {
  const errors: string[] = [];

  const gate = evaluateManifestPromoteGate({
    baseConfig: CONCIERGE_PLATFORM_DEFAULTS,
    currentManifest: scenario.currentManifest,
    proposedManifest: scenario.proposedManifest,
    timelineEvents: scenario.timeline,
    simSessionId: scenario.simSessionId ?? null,
  });

  if (gate.requiresTimelineSim !== scenario.expect.requiresTimelineSim) {
    errors.push(
      `requiresTimelineSim: expected ${scenario.expect.requiresTimelineSim}, got ${gate.requiresTimelineSim}`
    );
  }

  if (gate.ok !== scenario.expect.ok) {
    errors.push(
      `ok: expected ${scenario.expect.ok}, got ${gate.ok} — ${gate.violations.join("; ")}`
    );
  }

  for (const fragment of scenario.expect.violationIncludes ?? []) {
    if (!gate.violations.some((v) => v.includes(fragment))) {
      errors.push(`missing violation fragment: ${fragment}`);
    }
  }

  if (
    scenario.expect.ok &&
    gate.requiresTimelineSim &&
    gate.simReport &&
    evaluateSimRegression(gate.simReport).length > 0
  ) {
    errors.push("expected green sim but regression detected");
  }

  return {
    id: scenario.id,
    passed: errors.length === 0,
    errors,
  };
}

/**
 * ADR-023 MR-8 / ADR-033 AGENT-26 — CI manifest promote gate + timeline sim replay.
 * Pair with `runTimelineObligationSuite` + `runQualityContractEval` in pilot gate.
 */
export function runManifestPromoteGateFixture(): ManifestPromoteGateFixtureReport {
  const results = MANIFEST_PROMOTE_GATE_SCENARIOS.map(runScenario);

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
