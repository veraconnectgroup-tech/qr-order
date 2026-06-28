import { describe, expect, it } from "vitest";
import {
  detectBonNumberGaps,
  type FiscalComplianceIssue,
} from "@/lib/fiscal/compliance-check";

describe("detectBonNumberGaps", () => {
  it("returns empty for consecutive sequence", () => {
    expect(detectBonNumberGaps([1, 2, 3, 4, 5])).toEqual([]);
  });

  it("detects single and multiple gaps", () => {
    expect(detectBonNumberGaps([1, 2, 4, 7])).toEqual([3, 5, 6]);
  });

  it("ignores duplicates and zero", () => {
    expect(detectBonNumberGaps([0, 1, 1, 3])).toEqual([2]);
  });

  it("returns empty for fewer than two numbers", () => {
    expect(detectBonNumberGaps([42])).toEqual([]);
    expect(detectBonNumberGaps([])).toEqual([]);
  });
});

describe("FiscalComplianceIssue severity", () => {
  it("missing TSE signature is CRITICAL", () => {
    const issue: FiscalComplianceIssue = {
      severity: "critical",
      code: "revenue_order_unsigned",
      message: "Order #42 has no TSE signature.",
      orderId: "order-001",
    };
    expect(issue.severity).toBe("critical");
    expect(issue.code).toBe("revenue_order_unsigned");
  });

  it("bon number gap is warning", () => {
    const issue: FiscalComplianceIssue = {
      severity: "warning",
      code: "bon_number_gap",
      message: "Gap detected",
      missingBonNumbers: [5, 6],
    };
    expect(issue.severity).toBe("warning");
  });
});
