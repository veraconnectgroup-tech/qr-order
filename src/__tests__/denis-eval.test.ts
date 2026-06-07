import { describe, expect, it } from "vitest";
import { runMenuRagLightMealFixture } from "@/lib/denis/eval/run-menu-rag-fixture";
import { runActorFifoEvalSuite } from "@/lib/denis/eval/run-actor-fifo-fixture";
import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";
import { runBeliefsCompileFixture } from "@/lib/denis/eval/run-beliefs-fixture";
import { runFoldOrderVisibilityFixture } from "@/lib/denis/eval/run-fold-fixture";
import { runWorldTellUnificationFixture } from "@/lib/denis/eval/run-world-tell-fixture";
import { runPilotGate, runPilotSrEvalSuite } from "@/lib/denis/eval/run-pilot-gate";
import { runWaiterParitySuite } from "@/lib/denis/eval/run-waiter-parity";
import { runContinuousMindSuite } from "@/lib/denis/eval/run-continuous-mind-fixture";
import { runBrowseFoldSuite } from "@/lib/denis/eval/run-browse-fold-fixture";
import { runMentalModelSuite } from "@/lib/denis/eval/run-mental-model-fixture";
import { runMentalModelTimelineSuite } from "@/lib/denis/eval/run-mental-model-timeline-fixture";
import { runTimelineObligationSuite } from "@/lib/denis/eval/run-timeline-obligation-fixture";
import { runInterpretationTaskSuite } from "@/lib/denis/eval/run-interpretation-task-fixture";
import { CONTINUOUS_MIND_SCENARIOS } from "@/lib/denis/eval/fixtures/continuous-mind/scenarios";
import { MENTAL_MODEL_SCENARIOS } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { runManifestPromoteGateFixture } from "@/lib/denis/eval/run-manifest-promote-gate-fixture";
import { MANIFEST_PROMOTE_GATE_SCENARIOS } from "@/lib/denis/eval/fixtures/manifest/promote-gate-scenarios";
import { runPlaybookPackFixture } from "@/lib/denis/eval/run-playbook-pack-fixture";
import { IOTA_TIMELINE_OBLIGATION_SCENARIOS } from "@/lib/denis/eval/fixtures/timeline/iota-obligation-scenarios";
import { INTERPRETATION_TASK_SCENARIOS } from "@/lib/denis/eval/fixtures/interpretation-task/scenarios";
import { WAITER_PARITY_SCENARIOS } from "@/lib/denis/eval/fixtures/waiter-parity/scenarios";
import { DENIS_PILOT_SR_SCENARIOS } from "@/lib/denis/eval/fixtures/pilot-sr-scenarios";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import { DENIS_EVAL_SCENARIOS } from "@/lib/denis/eval/fixtures/scenarios";
import {
  diffShadowTurn,
  shadowParityPassed,
} from "@/lib/denis/runtime/shadow-diff";

describe("Denis eval fixtures M10", () => {
  it("runs full eval suite green", () => {
    const report = runDenisEvalSuite();
    if (!report.ok) {
      const failed = report.results.filter((row) => !row.passed);
      console.error(JSON.stringify(failed, null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(DENIS_EVAL_SCENARIOS.length);
  });

  it("cola_conflict scenario passes", () => {
    const result = runDenisScenario(
      DENIS_EVAL_SCENARIOS.find((row) => row.id === "cola_conflict")!
    );
    expect(result.passed).toBe(true);
    expect(result.actual.topGoal).toBe("RECONCILE_CART");
  });

  it("fold sees submitted order in commerce.orders (Phase A)", () => {
    const result = runFoldOrderVisibilityFixture();
    expect(result.passed).toBe(true);
    expect(result.orderCount).toBe(1);
  });

  it("compileBeliefs produces 11 core beliefs (MR-1 + ADR-030)", () => {
    const result = runBeliefsCompileFixture();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
    expect(result.beliefCount).toBe(19);
  });

  it("world tell word-match: push body === tell.committed === headline (Phase D)", () => {
    const result = runWorldTellUnificationFixture();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
  });

  it("menu RAG embeddings: nešto lagano → Lagana salata (E2.1)", async () => {
    const result = await runMenuRagLightMealFixture();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
    expect(result.topProductId).toBe("food-light");
  });

  it("table session actor FIFO + 2-phone race eval passes (Phase E / M2)", async () => {
    const result = await runActorFifoEvalSuite();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
  });

  it("pilot SR eval suite passes (G3)", () => {
    const report = runPilotSrEvalSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(DENIS_PILOT_SR_SCENARIOS.length);
  });

  it("continuous mind obligation merge passes (ARCH-6)", () => {
    const report = runContinuousMindSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(CONTINUOUS_MIND_SCENARIOS.length);
  });

  it("browse fold eval passes (proactive F1)", () => {
    const report = runBrowseFoldSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
  });

  it("guest posture fold + gate passes (ADR-038 Val B)", () => {
    const report = runMentalModelSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(MENTAL_MODEL_SCENARIOS.length);
    expect(report.foldMsP500).toBeLessThan(6);
  });

  it("mental model timeline observability passes (ADR-038 Val B.5)", () => {
    const report = runMentalModelTimelineSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBeGreaterThanOrEqual(5);
  });

  it("iota timeline obligation replay passes (ADR-032 P1-T7)", () => {
    const report = runTimelineObligationSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(IOTA_TIMELINE_OBLIGATION_SCENARIOS.length);
  });

  it("playbook pack ton differs skyline vs generic-chain (MR-9 / C11)", () => {
    const result = runPlaybookPackFixture();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
  });

  it("waiter parity journey eval passes (ADR-031 C3)", () => {
    const report = runWaiterParitySuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(WAITER_PARITY_SCENARIOS.length);
  });

  it("manifest promote gate + timeline sim passes (ADR-023 MR-8 / AGENT-26)", () => {
    const report = runManifestPromoteGateFixture();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(MANIFEST_PROMOTE_GATE_SCENARIOS.length);
  });

  it("L3 interpretation task goal-directed eval passes (ARCH-7 / C12)", () => {
    const report = runInterpretationTaskSuite();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.ok).toBe(true);
    expect(report.scenarioCount).toBe(INTERPRETATION_TASK_SCENARIOS.length);
  });

  it("full pilot gate is green (G3)", () => {
    const gate = runPilotGate();
    if (!gate.ok) {
      console.error(
        JSON.stringify(
          {
            coreFailed: gate.core.results.filter((r) => !r.passed),
            srFailed: gate.pilotSr.results.filter((r) => !r.passed),
            timelineFailed: gate.timelineObligation.results.filter((r) => !r.passed),
            continuousMindFailed: gate.continuousMind.results.filter((r) => !r.passed),
            manifestPromoteFailed: gate.manifestPromoteGate.results.filter(
              (r) => !r.passed
            ),
            waiterParityFailed: gate.waiterParity.results.filter((r) => !r.passed),
            worldTell: gate.worldTell,
            anticipationFailed: gate.anticipation.results.filter((r) => !r.passed),
            qualityContract: gate.qualityContract.violations,
            narration: gate.narration,
            presetChecks: gate.presetChecks.filter((c) => !c.passed),
          },
          null,
          2
        )
      );
    }
    expect(gate.ok).toBe(true);
  });
});

describe("Denis shadow diff M10", () => {
  it("scores parity when intent aligns", () => {
    const diff = diffShadowTurn({
      legacy: { intent: "order", cartActionCount: 1, submitOrder: false },
      denis: {
        intent: "ORDER",
        skillIds: ["cart.add_or_clarify"],
        hasConflict: false,
      },
    });
    expect(shadowParityPassed(diff)).toBe(true);
  });
});
