import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  DEGRADATION_LEVEL_ORDER,
  resolveDegradationLevel,
  resolveTargetDegradationLevel,
  stepDegradationLevel,
  degradationGuestOfflineMessage,
  type DegradationHealthInput,
  type DegradationLevel,
} from "@/lib/denis/config/degradation-ladder";

function healthyMetrics(
  overrides: Partial<DegradationHealthInput> = {}
): DegradationHealthInput {
  return {
    avgResponseMs: 1200,
    llmErrorRate: 0,
    uptimePercent: 99.8,
    activeSessionCount: 4,
    stuckSessions: [],
    ...overrides,
  };
}

describe("Graceful degradation ladder (V2)", () => {
  it("avgResponse 6000ms targets reduced", () => {
    const target = resolveTargetDegradationLevel(
      healthyMetrics({ avgResponseMs: 6_000 })
    );
    expect(target).toBe("reduced");

    const resolution = resolveDegradationLevel({
      health: healthyMetrics({ avgResponseMs: 6_000 }),
      currentLevel: "full",
      levelSince: Date.now() - 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });
    expect(resolution.level).toBe("reduced");
    expect(resolution.staffMessage).toContain("sporije");
  });

  it("errorRate 0.3 targets essential after one step from full", () => {
    const target = resolveTargetDegradationLevel(
      healthyMetrics({ llmErrorRate: 0.3 })
    );
    expect(target).toBe("essential");
  });

  it("recovery after 10min stable returns full from reduced", () => {
    const now = Date.now();
    const allowed = resolveDegradationLevel({
      health: healthyMetrics(),
      currentLevel: "reduced",
      levelSince: now - 10 * 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now,
    });
    expect(allowed.level).toBe("full");
  });

  it("fallback recovery waits 3 minutes before essential", () => {
    const now = Date.now();
    const blocked = resolveDegradationLevel({
      health: healthyMetrics(),
      currentLevel: "fallback",
      levelSince: now - 2 * 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now,
    });
    expect(blocked.level).toBe("fallback");

    const allowed = resolveDegradationLevel({
      health: healthyMetrics(),
      currentLevel: "fallback",
      levelSince: now - 4 * 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now,
    });
    expect(allowed.level).toBe("essential");
  });

  it("isDegradationFeatureDisabled gates personalization at essential", () => {
    expect(
      resolveDegradationLevel({
        health: healthyMetrics({ llmErrorRate: 0.25 }),
        currentLevel: "essential",
        levelSince: Date.now() - 120_000,
        config: CONCIERGE_PLATFORM_DEFAULTS,
      }).disabledFeatures
    ).toContain("menu_personalization");
  });

  it("llmErrorRate=25% targets essential (between reduced and fallback thresholds)", () => {
    const target = resolveTargetDegradationLevel(
      healthyMetrics({ llmErrorRate: 0.25 })
    );
    expect(target).toBe("essential");
  });

  it("llmErrorRate=25% steps full → reduced → essential (never instant jump)", () => {
    const health = healthyMetrics({ llmErrorRate: 0.25 });
    const config = CONCIERGE_PLATFORM_DEFAULTS;
    const now = Date.now();

    const first = resolveDegradationLevel({
      health,
      currentLevel: "full",
      levelSince: now - 180_000,
      config,
      now,
    });
    expect(first.level).toBe("reduced");

    const second = resolveDegradationLevel({
      health,
      currentLevel: first.level,
      levelSince: now,
      config,
      now: now + 1,
    });
    expect(second.level).toBe("essential");
    expect(second.disabledFeatures).toContain("menu_personalization");
    expect(second.staffMessage).toContain("samo prima narudžbe");
  });

  it("never jumps more than one level per step toward offline", () => {
    const worst = healthyMetrics({
      avgResponseMs: 50_000,
      llmErrorRate: 0.95,
      uptimePercent: 0.2,
      activeSessionCount: 3,
      stuckSessions: ["a", "b", "c"],
    });

    let level: DegradationLevel = "full";
    const seen: DegradationLevel[] = [level];
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      const next = stepDegradationLevel({
        currentLevel: level,
        targetLevel: resolveTargetDegradationLevel(worst),
        levelSince: now - 600_000,
        now,
      });
      if (next === level) break;
      const prevIdx = DEGRADATION_LEVEL_ORDER.indexOf(level);
      const nextIdx = DEGRADATION_LEVEL_ORDER.indexOf(next);
      expect(Math.abs(nextIdx - prevIdx)).toBe(1);
      level = next;
      seen.push(level);
    }

    expect(seen).toEqual(["full", "reduced", "essential", "fallback", "offline"]);
  });

  it("recovery waits for stable window before stepping up", () => {
    const recovered = healthyMetrics();
    const now = Date.now();

    const blocked = resolveDegradationLevel({
      health: recovered,
      currentLevel: "reduced",
      levelSince: now - 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now,
    });
    expect(blocked.level).toBe("reduced");

    const allowed = resolveDegradationLevel({
      health: recovered,
      currentLevel: "reduced",
      levelSince: now - 11 * 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now,
    });
    expect(allowed.level).toBe("full");
  });

  it("reduced disables proactive, upsell, and scene intelligence", () => {
    const resolution = resolveDegradationLevel({
      health: healthyMetrics({ avgResponseMs: 6_000 }),
      currentLevel: "full",
      levelSince: Date.now() - 60_000,
      config: CONCIERGE_PLATFORM_DEFAULTS,
    });

    expect(resolution.level).toBe("reduced");
    expect(resolution.disabledFeatures).toEqual([
      "proactive_nudges",
      "upsell",
      "scene_intelligence",
    ]);
  });

  it("offline guest message is guest-safe (no error wording)", () => {
    const message = degradationGuestOfflineMessage("sr");
    expect(message.toLowerCase()).not.toContain("error");
    expect(message).toContain("menij");
  });
});
