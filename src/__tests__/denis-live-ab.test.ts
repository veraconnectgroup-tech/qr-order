import { describe, expect, it } from "vitest";
import {
  assignSessionVariant,
  evaluateExperiment,
  LIVE_AB_CONSTANTS,
  type Experiment,
  type SessionMetrics,
} from "@/lib/denis/experiments/live-ab";
import { deriveLiveAbSessionMetrics } from "@/lib/denis/experiments/live-ab-store";

const baseExperiment: Experiment = {
  id: "exp-dessert-timing",
  metric: "conversion_rate",
  variantA: { upsell: { dessertDelayMinutes: 8 } },
  variantB: { upsell: { dessertDelayMinutes: 5 } },
  trafficSplit: 0.5,
  minSessions: 100,
  startedAt: "2026-06-01T10:00:00.000Z",
  status: "running",
};

function buildSessions(
  prefix: string,
  count: number,
  conversionRate: number
): SessionMetrics[] {
  const convertedCount = Math.round(count * conversionRate);
  return Array.from({ length: count }, (_, index) => ({
    sessionToken: `${prefix}-${index}`,
    converted: index < convertedCount,
    orderValueCents: index < convertedCount ? 2500 : 0,
    upsellAccepted: false,
    minutesToFirstOrder: index < convertedCount ? 12 : null,
  }));
}

describe("deriveLiveAbSessionMetrics", () => {
  it("returns null when the session.completed payload has no sessionToken", () => {
    expect(
      deriveLiveAbSessionMetrics("loc-1", { revenue: 42 })
    ).toBeNull();
  });

  it("converts revenue to cents and marks the session converted", () => {
    const metrics = deriveLiveAbSessionMetrics("loc-1", {
      sessionToken: "sess-abc",
      revenue: 84.5,
      firstOrderLagSeconds: 192,
      upsellAccepted: true,
    });

    expect(metrics).toEqual({
      locationId: "loc-1",
      sessionToken: "sess-abc",
      converted: true,
      orderValueCents: 8450,
      upsellAccepted: true,
      minutesToFirstOrder: 3.2,
    });
  });

  it("marks a zero-revenue session as not converted, with null lag when absent", () => {
    const metrics = deriveLiveAbSessionMetrics("loc-1", {
      sessionToken: "sess-empty",
      revenue: 0,
    });

    expect(metrics).toEqual({
      locationId: "loc-1",
      sessionToken: "sess-empty",
      converted: false,
      orderValueCents: 0,
      upsellAccepted: false,
      minutesToFirstOrder: null,
    });
  });

  it("degrades non-numeric revenue to 0 rather than NaN", () => {
    const metrics = deriveLiveAbSessionMetrics("loc-1", {
      sessionToken: "sess-bad",
      revenue: "not-a-number",
    });

    expect(metrics?.orderValueCents).toBe(0);
    expect(metrics?.converted).toBe(false);
  });
});

describe("assignSessionVariant", () => {
  it("assigns deterministically per session token", () => {
    const a = assignSessionVariant(baseExperiment, "session-abc");
    const b = assignSessionVariant(baseExperiment, "session-abc");
    const c = assignSessionVariant(baseExperiment, "session-xyz");

    expect(a).toBe(b);
    expect(["A", "B"]).toContain(a);
    expect(["A", "B"]).toContain(c);
  });
});

describe("evaluateExperiment", () => {
  it("200 sessions, A=15% vs B=22% → winner B, lift ~+46%", () => {
    const sessionsA = buildSessions("a", 100, 0.15);
    const sessionsB = buildSessions("b", 100, 0.22);

    const result = evaluateExperiment(baseExperiment, sessionsA, sessionsB);

    expect(result.winner).toBe("B");
    expect(result.variantAMetric).toBeCloseTo(0.15, 2);
    expect(result.variantBMetric).toBeCloseTo(0.22, 2);
    expect(result.lift).toBeCloseTo(0.4667, 2);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.sessionsRemaining).toBe(0);
  });

  it("requires min 100 sessions per variant before declaring winner at 95% confidence", () => {
    const sessionsA = buildSessions("a", 40, 0.1);
    const sessionsB = buildSessions("b", 40, 0.3);
    const result = evaluateExperiment(baseExperiment, sessionsA, sessionsB);

    expect(result.sessionsRemaining).toBeGreaterThan(0);
    expect(result.winner).toBe("inconclusive");
  });

  it("stronger lift reaches auto-apply confidence threshold", () => {
    const sessionsA = buildSessions("a", 100, 0.15);
    const sessionsB = buildSessions("b", 100, 0.26);

    const result = evaluateExperiment(baseExperiment, sessionsA, sessionsB);

    expect(result.winner).toBe("B");
    expect(result.confidence).toBeGreaterThanOrEqual(
      LIVE_AB_CONSTANTS.AUTO_APPLY_CONFIDENCE
    );
  });
});
