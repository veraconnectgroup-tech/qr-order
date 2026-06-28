import { describe, expect, it } from "vitest";
import {
  compareEvalToBaseline,
  evalGatePassed,
  runFullEvalMetrics,
} from "@/lib/denis/eval/eval-gate";

describe("Eval gate (AM1)", () => {
  it(
    "passes against baseline thresholds",
    () => {
      const current = runFullEvalMetrics();
      const comparison = compareEvalToBaseline(
        {
          waiterParity: 1,
          anticipation: 1,
          reflexAccuracy: 1,
          venueSimScore: 0.85,
          omniscient: 1,
        },
        current
      );
      expect(comparison.waiterParity.pass).toBe(true);
      expect(comparison.anticipation.pass).toBe(true);
      expect(comparison.reflexAccuracy.pass).toBe(true);
      expect(comparison.venueSimScore.pass).toBe(true);
      expect(comparison.omniscient.pass).toBe(true);
    },
    120_000
  );

  it("blocks when waiter parity drops", () => {
    const comparison = compareEvalToBaseline(
      {
        waiterParity: 1,
        anticipation: 1,
        reflexAccuracy: 1,
        venueSimScore: 0.85,
        omniscient: 1,
      },
      {
        waiterParity: 0.9,
        anticipation: 1,
        reflexAccuracy: 1,
        venueSimScore: 0.85,
        omniscient: 1,
      }
    );
    expect(comparison.waiterParity.pass).toBe(false);
    expect(
      evalGatePassed(
        {
          waiterParity: 1,
          anticipation: 1,
          reflexAccuracy: 1,
          venueSimScore: 0.85,
          omniscient: 1,
        },
        {
          waiterParity: 0.9,
          anticipation: 1,
          reflexAccuracy: 1,
          venueSimScore: 0.85,
          omniscient: 1,
        }
      )
    ).toBe(false);
  });

  it("evalGatePassed helper matches comparison", () => {
    const current = {
      waiterParity: 1,
      anticipation: 1,
      reflexAccuracy: 1,
      venueSimScore: 0.9,
      omniscient: 1,
    };
    expect(
      evalGatePassed(
        {
          waiterParity: 1,
          anticipation: 1,
          reflexAccuracy: 1,
          venueSimScore: 0.85,
          omniscient: 1,
        },
        current
      )
    ).toBe(true);
  });
});
