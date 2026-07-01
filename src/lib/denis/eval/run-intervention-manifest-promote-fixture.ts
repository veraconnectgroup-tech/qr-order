import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { evaluateInterventionManifestPromoteGate } from "@/lib/denis/cognition/intervention/intervention-manifest-promote-gate";
import { INTERVENTION_MANIFEST_VERSION } from "@/lib/denis/cognition/intervention/intervention-manifest-defaults";
import { INTERVENTION_MANIFEST_SIM_SCENARIOS } from "@/lib/denis/eval/fixtures/intervention/manifest-sim-scenarios";

export type InterventionManifestPromoteScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type InterventionManifestPromoteFixtureReport = {
  ok: boolean;
  scenarioCount: number;
  results: InterventionManifestPromoteScenarioResult[];
};

function runScenario(input: {
  id: string;
  gate: ReturnType<typeof evaluateInterventionManifestPromoteGate>;
  expectOk: boolean;
  expectRequiresTimelineSim?: boolean;
  violationIncludes?: string[];
}): InterventionManifestPromoteScenarioResult {
  const errors: string[] = [];

  if (input.gate.ok !== input.expectOk) {
    errors.push(
      `ok: expected ${input.expectOk}, got ${input.gate.ok} — ${input.gate.violations.join("; ")}`
    );
  }

  if (
    input.expectRequiresTimelineSim !== undefined &&
    input.gate.requiresTimelineSim !== input.expectRequiresTimelineSim
  ) {
    errors.push(
      `requiresTimelineSim: expected ${input.expectRequiresTimelineSim}, got ${input.gate.requiresTimelineSim}`
    );
  }

  for (const fragment of input.violationIncludes ?? []) {
    if (!input.gate.violations.some((row) => row.includes(fragment))) {
      errors.push(`missing violation fragment: ${fragment}`);
    }
  }

  return { id: input.id, passed: errors.length === 0, errors };
}

/** ADR-041 P3/P4 — CI gate for intervention manifest promotion + sim replay. */
export function runInterventionManifestPromoteFixture(): InterventionManifestPromoteFixtureReport {
  const enforceReadyConfig = {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    proactive: {
      ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
      offerEnrich: true,
    },
    mentalModel: {
      ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
      mode: "enforce" as const,
    },
    intervention: {
      enabled: true,
      mode: "shadow" as const,
      manifestVersion: null,
    },
  };

  const results = [
    runScenario({
      id: "ijs_first_promote",
      gate: evaluateInterventionManifestPromoteGate({
        baseConfig: enforceReadyConfig,
        currentManifestVersion: null,
        proposedManifestVersion: INTERVENTION_MANIFEST_VERSION,
      }),
      expectOk: true,
      expectRequiresTimelineSim: false,
    }),
    runScenario({
      id: "ijs_enforce_without_pairing_blocked",
      gate: evaluateInterventionManifestPromoteGate({
        baseConfig: CONCIERGE_PLATFORM_DEFAULTS,
        currentManifestVersion: null,
        proposedManifestVersion: INTERVENTION_MANIFEST_VERSION,
        targetMode: "enforce",
      }),
      expectOk: false,
      violationIncludes: ["mentalModel.mode must be enforce"],
    }),
    runScenario({
      id: "ijs_rule_change_requires_sim_with_corpus",
      gate: evaluateInterventionManifestPromoteGate({
        baseConfig: enforceReadyConfig,
        currentManifestVersion: INTERVENTION_MANIFEST_VERSION,
        proposedManifestVersion: INTERVENTION_MANIFEST_VERSION,
        simScenarios: INTERVENTION_MANIFEST_SIM_SCENARIOS,
        timelineReplayAvailable: true,
      }),
      expectOk: true,
      expectRequiresTimelineSim: false,
    }),
  ];

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
