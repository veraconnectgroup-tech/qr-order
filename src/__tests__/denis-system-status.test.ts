import { describe, expect, it } from "vitest";
import { computeDenisSystemStatusEval } from "@/lib/admin/denis-system-status-eval";

describe("Denis system status", () => {
  it("reports eval gates", () => {
    const result = computeDenisSystemStatusEval();
    expect(result.eval.coreTotal).toBeGreaterThan(0);
    expect(result.eval.waiterParityTotal).toBeGreaterThanOrEqual(40);
    expect(result.gaps.proactiveInLoop).toBe(false);
  });
});
