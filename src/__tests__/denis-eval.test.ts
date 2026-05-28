import { describe, expect, it } from "vitest";
import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";
import { runFoldOrderVisibilityFixture } from "@/lib/denis/eval/run-fold-fixture";
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
