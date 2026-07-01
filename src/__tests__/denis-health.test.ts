import { describe, expect, it } from "vitest";
import {
  aggregateTurnSamples,
  DEFAULT_DENIS_HEALTH_CONTRACT,
  evaluateDenisHealth,
  shouldForceT0Only,
  type DenisHealthMetrics,
} from "@/lib/denis/monitoring";

function baseMetrics(
  overrides: Partial<DenisHealthMetrics> = {}
): DenisHealthMetrics {
  return {
    uptimePercent: 99.8,
    avgResponseMs: 1200,
    p95ResponseMs: 2100,
    refusalRate: 0,
    loopDetectionCount: 0,
    t0HitRate: 0.45,
    llmErrorRate: 0,
    creditBurnRatePerHour: 12,
    activeSessionCount: 8,
    stuckSessions: [],
    ...overrides,
  };
}

describe("Denis health evaluation (S1)", () => {
  it("healthy when response fast, no refusals, no loops", () => {
    const result = evaluateDenisHealth(
      baseMetrics(),
      DEFAULT_DENIS_HEALTH_CONTRACT
    );

    expect(result.status).toBe("healthy");
    expect(result.issues).toEqual([]);
    expect(result.autoActions).toEqual([]);
  });

  it("avgResponseMs=9000 + refusalRate=3% → critical with T0 fallback", () => {
    const result = evaluateDenisHealth(
      baseMetrics({
        avgResponseMs: 9000,
        refusalRate: 0.03,
      }),
      DEFAULT_DENIS_HEALTH_CONTRACT
    );

    expect(result.status).toBe("critical");
    expect(shouldForceT0Only(result)).toBe(true);
    expect(result.autoActions.some((a) => a.type === "t0_only")).toBe(true);
    expect(result.autoActions.some((a) => a.type === "skip_upsell")).toBe(true);
    expect(
      result.autoActions.some(
        (a) => a.type === "staff_alert" && a.message.includes("minimalnom")
      )
    ).toBe(true);
  });

  it("degraded on elevated response 3–8s", () => {
    const result = evaluateDenisHealth(
      baseMetrics({ avgResponseMs: 5000 }),
      DEFAULT_DENIS_HEALTH_CONTRACT
    );

    expect(result.status).toBe("degraded");
    expect(result.autoActions.some((a) => a.type === "skip_upsell")).toBe(true);
    expect(
      result.autoActions.some(
        (a) => a.type === "staff_alert" && a.message.includes("usporen")
      )
    ).toBe(true);
  });

  it("degraded when loop detection count > 0", () => {
    const result = evaluateDenisHealth(
      baseMetrics({ loopDetectionCount: 1 }),
      DEFAULT_DENIS_HEALTH_CONTRACT
    );

    expect(result.status).toBe("degraded");
    expect(result.issues.some((i) => i.includes("loop"))).toBe(true);
  });

  it("aggregateTurnSamples computes t0 hit rate", () => {
    const now = Date.now();
    const agg = aggregateTurnSamples([
      {
        ts: now - 3_600_000,
        latencyMs: 800,
        llmUsed: false,
        llmError: false,
        refusal: false,
        credits: 0,
      },
      {
        ts: now,
        latencyMs: 2200,
        llmUsed: true,
        llmError: false,
        refusal: false,
        credits: 2,
      },
    ]);

    expect(agg.t0HitRate).toBe(0.5);
    expect(agg.avgResponseMs).toBe(1500);
  });
});
