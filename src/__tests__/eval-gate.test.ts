import { describe, expect, it } from "vitest";
import {
  compareEvalToBaseline,
  evalGatePassed,
  runFullEvalMetrics,
} from "@/lib/denis/eval/eval-gate";

describe("Eval gate (AM1)", () => {
  it("passes against baseline thresholds", () => {
    const current = runFullEvalMetrics();
    const comparison = compareEvalToBaseline(
      {
        waiterParity: 1,
        anticipation: 1,
        reflexAccuracy: 1,
      },
      current
    );
    expect(comparison.waiterParity.pass).toBe(true);
    expect(comparison.anticipation.pass).toBe(true);
    expect(comparison.reflexAccuracy.pass).toBe(true);
  });

  it("blocks when waiter parity drops", () => {
    const comparison = compareEvalToBaseline(
      { waiterParity: 1, anticipation: 1, reflexAccuracy: 1 },
      { waiterParity: 0.9, anticipation: 1, reflexAccuracy: 1 }
    );
    expect(comparison.waiterParity.pass).toBe(false);
    expect(
      evalGatePassed(
        { waiterParity: 1, anticipation: 1, reflexAccuracy: 1 },
        { waiterParity: 0.9, anticipation: 1, reflexAccuracy: 1 }
      )
    ).toBe(false);
  });

  it("evalGatePassed helper matches comparison", () => {
    expect(
      evalGatePassed({ waiterParity: 1, anticipation: 1, reflexAccuracy: 1 })
    ).toBe(true);
  });
});
