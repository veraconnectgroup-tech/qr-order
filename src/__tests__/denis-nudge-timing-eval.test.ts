import { describe, expect, it } from "vitest";
import {
  runNudgeTimingEval,
  runNudgeTimingGapScenario,
} from "@/lib/denis/eval/run-nudge-timing-eval";
import { NUDGE_TIMING_SCENARIOS } from "@/lib/denis/eval/fixtures/nudge-timing/scenarios";

/**
 * Blind-spot eval #4 (quality-audit follow-up): denis-proactive-rank.test.ts
 * / denis-proactive-tick.test.ts prove the dessert-window MECHANICAL
 * trigger works (threshold math). Neither tests TIMING judgment — does a
 * nudge actually respect whether now is a good moment. This suite proves
 * the real mechanism that DOES exist (frustration-blocks-upsell gating a
 * near-in-time complaint under mentalModelMode "enforce", exercised
 * through the real pickProactiveCandidate() entry point) and separately,
 * honestly documents a real gap the mechanism doesn't cover.
 */
describe("proactive nudge timing eval", () => {
  it("blocks the dessert nudge when the guest complained ~30s ago, even though the dessert window is ready", () => {
    const report = runNudgeTimingEval();
    if (!report.ok) {
      console.error(JSON.stringify(report.results.filter((r) => !r.passed), null, 2));
    }
    expect(report.scenarioCount).toBe(NUDGE_TIMING_SCENARIOS.length);
    expect(report.ok).toBe(true);

    const blocked = report.results.find(
      (r) => r.id === "gmm-recent-complaint-blocks-dessert"
    )!;
    expect(blocked.passed).toBe(true);
    expect(blocked.candidateKind).not.toBe("dessert_nudge");
    expect(blocked.policyReason).toBe("gmm.frustration_mild");
  });

  it("still fires the dessert nudge for a calm meal with no complaints", () => {
    const report = runNudgeTimingEval();
    const fired = report.results.find((r) => r.id === "gmm-calm-meal-dessert-fires")!;
    expect(fired.passed).toBe(true);
    expect(fired.candidateKind).toBe("dessert_nudge");
  });

  it(
    "DOCUMENTED GAP: an emotionally heavy guest message with no complaint/status keywords does not block the dessert nudge today",
    () => {
      const result = runNudgeTimingGapScenario();
      // This assertion records CURRENT behavior, not desired behavior — see
      // the long comment in fixtures/nudge-timing/scenarios.ts. If this
      // ever starts failing (candidateKind !== "dessert_nudge"), it means
      // someone wired a real "is now emotionally a bad moment" judgment
      // in — at which point this test (and its comment) should be
      // deleted, not "fixed".
      expect(result.candidateKind).toBe("dessert_nudge");
    }
  );
});
