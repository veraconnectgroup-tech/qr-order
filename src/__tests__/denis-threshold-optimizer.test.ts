import { describe, expect, it } from "vitest";
import {
  buildThresholdConversionSeries,
  formatThresholdDigestSection,
  formatThresholdOwnerSuggestion,
  optimizeThresholds,
  suggestThresholdChanges,
  type NudgeOutcome,
} from "@/lib/denis/learning/threshold-optimizer";

function browseOutcomes(
  timingMinutes: number,
  accepted: number,
  total: number
): NudgeOutcome[] {
  return Array.from({ length: total }, (_, index) => ({
    nudgeKind: "browse_nudge",
    timingMinutes,
    outcome: index < accepted ? "accepted" : "declined",
  }));
}

describe("optimizeThresholds M3", () => {
  it("200 browse_nudge outcomes → optimal timing with confidence > 0.9", () => {
    const outcomes = [
      ...browseOutcomes(3, 23, 100),
      ...browseOutcomes(5, 12, 100),
    ];

    const metrics = optimizeThresholds({
      nudgeOutcomes: outcomes,
      lookbackDays: 14,
      currentThresholds: { browseNudgeMinutes: 5 },
    });

    const browse = metrics.find((row) => row.key === "browseNudgeMinutes");
    expect(browse).toBeDefined();
    expect(browse!.optimalValue).toBe(3);
    expect(browse!.conversionAtOptimal).toBeCloseTo(0.23, 2);
    expect(browse!.conversionAtCurrent).toBeCloseTo(0.12, 2);
    expect(browse!.sampleSize).toBe(100);
    expect(browse!.confidence).toBeGreaterThan(0.9);
  });

  it("requires 50 samples per bucket", () => {
    const outcomes = [
      ...browseOutcomes(2, 9, 40),
      ...browseOutcomes(3, 4, 40),
    ];

    const metrics = optimizeThresholds({
      nudgeOutcomes: outcomes,
      lookbackDays: 14,
      currentThresholds: { browseNudgeMinutes: 3 },
    });

    expect(metrics).toEqual([]);
  });

  it("suggestThresholdChanges only when confidence >= 90%", () => {
    const outcomes = [
      ...browseOutcomes(3, 23, 100),
      ...browseOutcomes(5, 12, 100),
    ];
    const metrics = optimizeThresholds({
      nudgeOutcomes: outcomes,
      lookbackDays: 14,
      currentThresholds: { browseNudgeMinutes: 5 },
    });

    const suggestions = suggestThresholdChanges(metrics);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.optimalValue).toBe(3);
    expect(suggestions[0]?.confidence).toBeGreaterThan(0.9);
  });

  it("formats owner-facing suggestion copy", () => {
    const line = formatThresholdOwnerSuggestion({
      key: "browseNudgeMinutes",
      currentValue: 5,
      optimalValue: 3,
      conversionAtCurrent: 0.12,
      conversionAtOptimal: 0.23,
      sampleSize: 100,
      confidence: 0.95,
    });

    expect(line).toBe(
      "Browse nudge na 3min ima 23% konverziju vs 12% na 5min"
    );
  });

  it("builds conversion series for dashboard charts", () => {
    const outcomes = [
      ...browseOutcomes(3, 23, 100),
      ...browseOutcomes(5, 12, 100),
    ];
    const series = buildThresholdConversionSeries({
      nudgeOutcomes: outcomes,
      currentThresholds: { browseNudgeMinutes: 5 },
    });

    expect(series).toHaveLength(1);
    expect(series[0]?.buckets.some((bucket) => bucket.eligible)).toBe(true);
  });

  it("formats weekly digest lines", () => {
    const lines = formatThresholdDigestSection([
      {
        key: "browseNudgeMinutes",
        currentValue: 5,
        optimalValue: 3,
        conversionAtCurrent: 0.12,
        conversionAtOptimal: 0.23,
        sampleSize: 100,
        confidence: 0.92,
      },
    ]);

    expect(lines[0]).toContain("TIMING OPTIMIZACIJA");
    expect(lines.join("\n")).toContain("Browse nudge na 3min");
  });
});
