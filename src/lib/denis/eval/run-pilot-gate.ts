import { assertRiskBoundaries } from "@/lib/denis/eval/assert-risk";
import { DENIS_PILOT_SR_SCENARIOS } from "@/lib/denis/eval/fixtures/pilot-sr-scenarios";
import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import type { EvalSuiteReport, ScenarioRunResult } from "@/lib/denis/eval/types";
import { resolveSkill } from "@/lib/denis/kernel/skill-registry";
import {
  hasCommittedNarrationFacts,
  shouldKeepLegacyConversationReply,
} from "@/lib/denis/runtime/narrate/has-committed-narration-facts";
import type { NarrationFacts } from "@/lib/denis/runtime/narrate/narration-facts.schema";
import { denisRolloutFormFromPreset } from "@/lib/denis/config/rollout-cutover";
import { evaluateGaGate } from "@/lib/denis/runtime/ga-gate";

const seatedFacts: NarrationFacts = {
  persona: { name: "Denis", tone: "warm_short", maxWords: 45 },
  language: "sr",
  goal: "GUEST_SEATED",
  committed: {},
  forbidden: [],
  allowedMentions: [],
};

function enrichPilotScenario(
  scenario: (typeof DENIS_PILOT_SR_SCENARIOS)[number],
  result: ScenarioRunResult
): ScenarioRunResult {
  const skills = result.actual.skillIds
    .map((id) => resolveSkill(id))
    .filter((skill): skill is NonNullable<typeof skill> => skill !== null);

  const risk = assertRiskBoundaries({
    skills,
    allowR5: scenario.expect.allowR5 ?? false,
  });

  if (risk.ok) return result;

  return {
    ...result,
    passed: false,
    errors: [...result.errors, ...risk.violations],
  };
}

export type PilotNarrationGateResult = {
  passed: boolean;
  errors: string[];
};

/** G3 — narration guards for seated SR guest (no reservation T3 override). */
export function runPilotNarrationGate(): PilotNarrationGateResult {
  const errors: string[] = [];

  if (hasCommittedNarrationFacts(seatedFacts)) {
    errors.push("empty GUEST_SEATED facts must not commit narration");
  }

  if (
    hasCommittedNarrationFacts({
      ...seatedFacts,
      committed: { returnGuestWelcome: "Dobrodošli nazad!" },
    })
  ) {
    errors.push("returnGuestWelcome alone must not commit narration facts");
  }

  const legacyReply =
    "Razumem — već ste za stolom. Recite šta želite da naručite.";
  if (!shouldKeepLegacyConversationReply(seatedFacts, legacyReply)) {
    errors.push("legacy seated reply should be kept over T3");
  }

  return { passed: errors.length === 0, errors };
}

/** G3 — SR kernel pilot scenarios only. */
export function runPilotSrEvalSuite(): EvalSuiteReport {
  const results = DENIS_PILOT_SR_SCENARIOS.map((scenario) =>
    enrichPilotScenario(scenario, runDenisScenario(scenario))
  );

  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0,
    scenarioCount: results.length,
    passed,
    failed,
    results,
    shadowParityThreshold: 99,
  };
}

export type PilotGateReport = {
  ok: boolean;
  core: EvalSuiteReport;
  pilotSr: EvalSuiteReport;
  narration: PilotNarrationGateResult;
  presetReady: boolean;
  presetChecks: ReturnType<typeof evaluateGaGate>["checks"];
};

/** G3 — full pilot gate: core eval + SR scenarios + narration + preset readiness. */
export function runPilotGate(): PilotGateReport {
  const core = runDenisEvalSuite();
  const pilotSr = runPilotSrEvalSuite();
  const narration = runPilotNarrationGate();

  const form = denisRolloutFormFromPreset("table_os_pilot");
  const ga = form
    ? evaluateGaGate(form, {
        recentEvalPass: core.ok && pilotSr.ok && narration.passed,
        pilotEvalPass: pilotSr.ok && narration.passed,
      })
    : { ready: false, checks: [] };

  return {
    ok: core.ok && pilotSr.ok && narration.passed,
    core,
    pilotSr,
    narration,
    presetReady: ga.ready,
    presetChecks: ga.checks,
  };
}
