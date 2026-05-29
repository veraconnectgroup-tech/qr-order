import { describe, expect, it } from "vitest";
import {
  runWaiterParityScenario,
  runWaiterParitySuite,
  WAITER_PARITY_MIN_SCENARIOS,
  WAITER_PARITY_SCENARIOS,
} from "@/lib/denis/eval/run-waiter-parity";

describe("ADR-031 C3 — waiter parity journey eval", () => {
  it("defines at least 40 scenarios", () => {
    expect(WAITER_PARITY_SCENARIOS.length).toBeGreaterThanOrEqual(
      WAITER_PARITY_MIN_SCENARIOS
    );
  });

  it("runs full waiter-parity suite green", () => {
    const report = runWaiterParitySuite();
    if (!report.ok) {
      const failed = report.results.filter((row) => !row.passed);
      console.error(JSON.stringify(failed, null, 2));
    }
    expect(report.scenarioCount).toBeGreaterThanOrEqual(WAITER_PARITY_MIN_SCENARIOS);
    expect(report.passRate).toBeGreaterThanOrEqual(report.minPassRate);
    expect(report.ok).toBe(true);
  });

  it("typo slot journey passes", () => {
    const result = runWaiterParityScenario(
      WAITER_PARITY_SCENARIOS.find((row) => row.id === "wp_slot_typo_veliko_povo")!
    );
    expect(result.passed).toBe(true);
  });
});
