import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  AB_EXPERIMENT_CONSTANTS,
  assignAbVariant,
  evaluateAbExperiment,
  hashSessionExperimentBucket,
  type AbExperiment,
  type AbSessionMetrics,
} from "@/lib/denis/config/ab-experiment";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  mergeAbVariantIntoConfig,
  resolveEffectiveConciergeConfig,
} from "@/lib/denis/config/resolve-effective-config";

const baseExperiment: AbExperiment = {
  id: "exp-dessert-timing",
  metric: "conversion_rate",
  variantA: { upsell: { dessertDelayMinutes: 8 } },
  variantB: { upsell: { dessertDelayMinutes: 5 } },
  trafficSplit: 0.5,
  minSessions: 100,
  autoApply: false,
  ownerApprovedApply: false,
  startedAt: "2026-06-01T10:00:00.000Z",
  status: "running",
};

function buildSessions(
  prefix: string,
  count: number,
  conversionRate: number
): AbSessionMetrics[] {
  const convertedCount = Math.round(count * conversionRate);
  return Array.from({ length: count }, (_, index) => ({
    sessionToken: `${prefix}-${index}`,
    converted: index < convertedCount,
    orderValueCents: index < convertedCount ? 2500 : 0,
    upsellAccepted: false,
    minutesToFirstOrder: index < convertedCount ? 12 : null,
  }));
}

describe("hashSessionExperimentBucket", () => {
  it("returns a stable bucket in [0, 999]", () => {
    const bucket = hashSessionExperimentBucket("session-abc", "exp-dessert-timing");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(1000);
    expect(hashSessionExperimentBucket("session-abc", "exp-dessert-timing")).toBe(
      bucket
    );
  });
});

describe("assignAbVariant", () => {
  it("assigns deterministically per session token", () => {
    const first = assignAbVariant(baseExperiment, "session-abc");
    const second = assignAbVariant(baseExperiment, "session-abc");
    const other = assignAbVariant(baseExperiment, "session-xyz");

    expect(first).toBe(second);
    expect(["A", "B"]).toContain(first);
    expect(["A", "B"]).toContain(other);
  });

  it("respects traffic split threshold on the 1000 bucket", () => {
    const splitExperiment = { ...baseExperiment, trafficSplit: 0.3 };
    const variant = assignAbVariant(splitExperiment, "session-split-test");
    const bucket = hashSessionExperimentBucket(
      "session-split-test",
      splitExperiment.id
    );

    expect(variant).toBe(bucket < 300 ? "A" : "B");
  });
});

describe("resolveEffectiveConciergeConfig", () => {
  it("merges variant patch into ConciergeConfig", () => {
    const baseConfig = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, null);
    const mergedB = mergeAbVariantIntoConfig(baseConfig, baseExperiment, "B");

    expect(mergedB.upsell.dessertDelayMinutes).toBe(5);
    expect(baseConfig.upsell.dessertDelayMinutes).not.toBe(5);

    const mergedA = mergeAbVariantIntoConfig(baseConfig, baseExperiment, "A");
    expect(mergedA.upsell.dessertDelayMinutes).toBe(8);
  });

  it("returns base config when experiment is not running", () => {
    const baseConfig = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, null);
    const resolved = resolveEffectiveConciergeConfig(
      baseConfig,
      { ...baseExperiment, status: "completed" },
      "session-abc"
    );

    expect(resolved.variant).toBeNull();
    expect(resolved.config).toBe(baseConfig);
  });
});

describe("evaluateAbExperiment", () => {
  it("200 sessions, A=15% vs B=22% → winner B, lift ~+46%", () => {
    const sessionsA = buildSessions("a", 100, 0.15);
    const sessionsB = buildSessions("b", 100, 0.22);

    const result = evaluateAbExperiment(baseExperiment, sessionsA, sessionsB);

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
    const result = evaluateAbExperiment(baseExperiment, sessionsA, sessionsB);

    expect(result.sessionsRemaining).toBeGreaterThan(0);
    expect(result.winner).toBe("inconclusive");
  });

  it("stronger lift reaches auto-apply confidence threshold", () => {
    const sessionsA = buildSessions("a", 100, 0.15);
    const sessionsB = buildSessions("b", 100, 0.26);

    const result = evaluateAbExperiment(baseExperiment, sessionsA, sessionsB);

    expect(result.winner).toBe("B");
    expect(result.confidence).toBeGreaterThanOrEqual(
      AB_EXPERIMENT_CONSTANTS.AUTO_APPLY_CONFIDENCE
    );
  });
});
