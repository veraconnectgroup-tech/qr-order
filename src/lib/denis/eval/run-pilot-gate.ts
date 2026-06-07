import { assertRiskBoundaries } from "@/lib/denis/eval/assert-risk";
import { DENIS_PILOT_SR_SCENARIOS } from "@/lib/denis/eval/fixtures/pilot-sr-scenarios";
import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import type { EvalSuiteReport, ScenarioRunResult } from "@/lib/denis/eval/types";
import { runQualityContractEval } from "@/lib/denis/eval/quality-contract-eval";
import { runAnticipationEval } from "@/lib/denis/eval/run-anticipation-eval";
import type { AnticipationReport } from "@/lib/denis/eval/anticipation-types";
import {
  runWaiterParitySuite,
  type WaiterParityReport,
} from "@/lib/denis/eval/run-waiter-parity";
import {
  runContinuousMindSuite,
  type ContinuousMindReport,
} from "@/lib/denis/eval/run-continuous-mind-fixture";
import {
  runTimelineObligationSuite,
  type TimelineObligationReport,
} from "@/lib/denis/eval/run-timeline-obligation-fixture";
import {
  runWorldTellUnificationFixture,
  type WorldTellUnificationResult,
} from "@/lib/denis/eval/run-world-tell-fixture";
import {
  runManifestPromoteGateFixture,
  type ManifestPromoteGateFixtureReport,
} from "@/lib/denis/eval/run-manifest-promote-gate-fixture";
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
  timelineObligation: TimelineObligationReport;
  continuousMind: ContinuousMindReport;
  waiterParity: WaiterParityReport;
  worldTell: WorldTellUnificationResult;
  manifestPromoteGate: ManifestPromoteGateFixtureReport;
  qualityContract: ReturnType<typeof runQualityContractEval>;
  anticipation: AnticipationReport;
  narration: PilotNarrationGateResult;
  presetReady: boolean;
  presetChecks: ReturnType<typeof evaluateGaGate>["checks"];
};

/** G3 — full pilot gate: core eval + SR scenarios + waiter parity + quality contract + narration. */
export function runPilotGate(): PilotGateReport {
  const core = runDenisEvalSuite();
  const pilotSr = runPilotSrEvalSuite();
  const timelineObligation = runTimelineObligationSuite();
  const continuousMind = runContinuousMindSuite();
  const waiterParity = runWaiterParitySuite();
  const worldTell = runWorldTellUnificationFixture();
  const manifestPromoteGate = runManifestPromoteGateFixture();
  const qualityContract = runQualityContractEval();
  const anticipation = runAnticipationEval();
  const narration = runPilotNarrationGate();

  const form = denisRolloutFormFromPreset("table_os_pilot");
  const ga = form
    ? evaluateGaGate(form, {
        recentEvalPass:
          core.ok &&
          pilotSr.ok &&
          timelineObligation.ok &&
          continuousMind.ok &&
          waiterParity.ok &&
          worldTell.passed &&
          manifestPromoteGate.ok &&
          qualityContract.ok &&
          anticipation.ok &&
          narration.passed,
        pilotEvalPass:
          pilotSr.ok &&
          continuousMind.ok &&
          waiterParity.ok &&
          worldTell.passed &&
          manifestPromoteGate.ok &&
          qualityContract.ok &&
          anticipation.ok &&
          narration.passed,
      })
    : { ready: false, checks: [] };

  return {
    ok:
      core.ok &&
      pilotSr.ok &&
      timelineObligation.ok &&
      continuousMind.ok &&
      waiterParity.ok &&
      worldTell.passed &&
      manifestPromoteGate.ok &&
      qualityContract.ok &&
      anticipation.ok &&
      narration.passed,
    core,
    pilotSr,
    timelineObligation,
    continuousMind,
    waiterParity,
    worldTell,
    manifestPromoteGate,
    qualityContract,
    anticipation,
    narration,
    presetReady: ga.ready,
    presetChecks: ga.checks,
  };
}
