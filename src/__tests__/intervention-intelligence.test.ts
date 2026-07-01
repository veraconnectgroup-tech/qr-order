import { describe, expect, it } from "vitest";
import {
  analyzeInterventionJournal,
  formatInterventionDigestLines,
} from "@/lib/denis/platform/intervention-intelligence";

describe("intervention-intelligence K1", () => {
  it("aggregates IJS outcomes from daily rollup keys", () => {
    const insight = analyzeInterventionJournal({
      byOutcome: {
        "ijs:evaluated:speak": 12,
        "ijs:evaluated:silence": 8,
        "ijs:evaluated:defer": 2,
        "ijs:committed": 6,
        "ijs:declined:ijs_enforce_block": 1,
      },
      byRuleId: {
        browse_stuck: 5,
        frustration_gate: 3,
      },
    });

    expect(insight.evaluatedSpeak).toBe(12);
    expect(insight.evaluatedSilence).toBe(8);
    expect(insight.evaluatedDefer).toBe(2);
    expect(insight.committed).toBe(6);
    expect(insight.shadowAccuracy).toBe(0.3);
  });

  it("formats digest lines for weekly owner email", () => {
    const lines = formatInterventionDigestLines(
      analyzeInterventionJournal({
        byOutcome: {
          "ijs:evaluated:speak": 10,
          "ijs:evaluated:silence": 4,
        },
        byRuleId: { dessert_window: 2 },
      })
    );

    expect(lines.some((line) => line.includes("IJS evaluacija"))).toBe(true);
    expect(lines.some((line) => line.includes("dessert_window"))).toBe(true);
  });
});
