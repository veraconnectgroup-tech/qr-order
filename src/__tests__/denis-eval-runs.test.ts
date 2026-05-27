import { describe, expect, it } from "vitest";
import { runDenisEvalSuite } from "@/lib/denis/eval/run-fixtures";

describe("Denis eval runs M24", () => {
  it("suite report has fields required for persist", () => {
    const report = runDenisEvalSuite();
    expect(report.scenarioCount).toBeGreaterThan(0);
    expect(report.passed + report.failed).toBe(report.scenarioCount);
    expect(typeof report.ok).toBe("boolean");
    expect(report.shadowParityThreshold).toBeGreaterThan(0);
    expect(report.results.length).toBe(report.scenarioCount);
    for (const row of report.results) {
      expect(row.scenarioId).toBeTruthy();
      expect(Array.isArray(row.errors)).toBe(true);
      expect(row.actual).toBeDefined();
    }
  });
});
