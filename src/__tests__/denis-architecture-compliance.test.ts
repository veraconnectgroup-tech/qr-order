import { describe, expect, it } from "vitest";
import {
  formatComplianceReport,
  runDenisArchitectureCompliance,
} from "@/lib/denis/architecture/compliance";
import { DENIS_IMPORT_MATRIX, DENIS_LAYERS } from "@/lib/denis/layers";

describe("Denis architecture compliance", () => {
  it("passes full repository compliance check", { timeout: 15_000 }, () => {
    const report = runDenisArchitectureCompliance();
    if (!report.ok) {
      console.error(formatComplianceReport(report));
    }
    expect(report.errors).toEqual([]);
  });

  it("defines import matrix for every layer", () => {
    for (const layer of DENIS_LAYERS) {
      expect(DENIS_IMPORT_MATRIX[layer]).toBeDefined();
    }
  });
});
