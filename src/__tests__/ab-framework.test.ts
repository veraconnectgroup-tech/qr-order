import { describe, expect, it } from "vitest";
import {
  assignExperimentVariant,
  evaluateAbExperiment,
  shouldAutoStopExperiment,
  type AbExperiment,
} from "@/lib/denis/experiments/ab-framework";
import type { SessionMetrics } from "@/lib/denis/experiments/live-ab";

const baseExperiment: AbExperiment = {
  id: "exp-shorter-greeting",
  name: "shorter_greeting_v2",
  description: "Shorter Denis greeting",
  status: "running",
  startDate: "2026-06-01T00:00:00.000Z",
  variants: {
    control: { config: {} },
    treatment: { config: { persona: { maxWordsPerReply: 30 } } },
  },
  splitPercent: 50,
  assignmentKey: "session",
  primaryMetric: "conversion_rate",
  secondaryMetrics: [],
};

function sessionBatch(
  count: number,
  convertedRatio: number,
  prefix: string
): SessionMetrics[] {
  const convertedCount = Math.round(count * convertedRatio);
  return Array.from({ length: count }, (_, index) => ({
    sessionToken: `${prefix}-${index}`,
    converted: index < convertedCount,
    orderValueCents: index < convertedCount ? 4200 : 0,
    upsellAccepted: false,
    minutesToFirstOrder: index < convertedCount ? 4 : null,
  }));
}

describe("assignExperimentVariant", () => {
  it("assigns deterministically for the same key", () => {
    const a = assignExperimentVariant(baseExperiment, "session-abc");
    const b = assignExperimentVariant(baseExperiment, "session-abc");
    expect(a).toBe(b);
  });

  it("respects split percent approximately", () => {
    let treatment = 0;
    for (let i = 0; i < 1000; i++) {
      if (assignExperimentVariant(baseExperiment, `session-${i}`) === "treatment") {
        treatment += 1;
      }
    }
    expect(treatment).toBeGreaterThan(400);
    expect(treatment).toBeLessThan(600);
  });
});

describe("evaluateAbExperiment", () => {
  it("detects significant lift with enough sessions", () => {
    const control = sessionBatch(120, 0.65, "c");
    const treatment = sessionBatch(120, 0.71, "t");

    const results = evaluateAbExperiment(baseExperiment, control, treatment);
    expect(results.controlSessions).toBe(120);
    expect(results.treatmentSessions).toBe(120);
    expect(results.treatmentMetric).toBeGreaterThan(results.controlMetric);
    expect(results.lift).toBeGreaterThan(0);
  });
});

describe("shouldAutoStopExperiment", () => {
  it("auto-stops when statistically significant", () => {
    const results = evaluateAbExperiment(
      baseExperiment,
      sessionBatch(120, 0.6, "c"),
      sessionBatch(120, 0.85, "t")
    );
    expect(shouldAutoStopExperiment(baseExperiment, results)).toBe(true);
  });

  it("auto-stops after 30 days max", () => {
    const oldExperiment: AbExperiment = {
      ...baseExperiment,
      startDate: "2026-05-01T00:00:00.000Z",
    };
    const results = evaluateAbExperiment(
      oldExperiment,
      sessionBatch(50, 0.65, "c"),
      sessionBatch(50, 0.66, "t")
    );
    expect(
      shouldAutoStopExperiment(oldExperiment, results, new Date("2026-06-27"))
    ).toBe(true);
  });
});
