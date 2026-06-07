import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { mergeConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  emptyLocationRhythmPriors,
  resolveRhythmPriors,
  rhythmSlotKey,
  slotConfidence,
} from "@/lib/denis/config/resolve-rhythm-priors";
import { applySessionCompletedToRhythmPriors } from "@/lib/commerce/projections/rollup-venue-rhythm-priors";

describe("resolveRhythmPriors", () => {
  it("returns inactive context when rhythm is off", () => {
    const config = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, null);
    const resolved = resolveRhythmPriors({
      config,
      priors: emptyLocationRhythmPriors(),
      now: new Date("2026-06-07T17:30:00.000Z"),
      timezone: "Europe/Berlin",
    });

    expect(resolved.active).toBe(false);
    expect(resolved.applied).toBe(false);
  });

  it("shadow mode exposes would-override without applying", () => {
    const config = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, {
      rhythm: { enabled: true, mode: "shadow" },
    });
    const priors = emptyLocationRhythmPriors();
    let rolling = priors;
    for (let i = 0; i < 8; i += 1) {
      rolling = applySessionCompletedToRhythmPriors(rolling, {
        slotKey: rhythmSlotKey(6, 19),
        localDow: 6,
        localHour: 19,
        durationMin: 42,
        dessertDelayMin: 18,
        revenue: 86.5,
        topProducts: [{ productId: "p1", name: "Burger", count: 2 }],
        servicePeriod: "dinner",
      });
    }

    const resolved = resolveRhythmPriors({
      config,
      priors: rolling,
      now: new Date("2026-06-06T17:30:00.000Z"),
      timezone: "Europe/Berlin",
    });

    expect(resolved.active).toBe(true);
    expect(resolved.applied).toBe(false);
    expect(resolved.wouldOverrideDessertDelayMinutes).toBe(18);
    expect(resolved.topProducts[0]?.name).toBe("Burger");
  });

  it("enforce mode applies override when confidence threshold met", () => {
    const config = mergeConciergeConfig(CONCIERGE_PLATFORM_DEFAULTS, null, {
      rhythm: { enabled: true, mode: "enforce", minSampleSessions: 4 },
    });

    let priors = emptyLocationRhythmPriors();
    for (let i = 0; i < 4; i += 1) {
      priors = applySessionCompletedToRhythmPriors(priors, {
        slotKey: rhythmSlotKey(2, 12),
        localDow: 2,
        localHour: 12,
        durationMin: 35,
        dessertDelayMin: 16,
        revenue: 40,
        topProducts: [],
        servicePeriod: "lunch",
      });
    }

    const resolved = resolveRhythmPriors({
      config,
      priors,
      now: new Date("2026-06-02T10:30:00.000Z"),
      timezone: "Europe/Berlin",
    });

    expect(resolved.applied).toBe(true);
    expect(resolved.wouldOverrideDessertDelayMinutes).toBe(16);
    expect(slotConfidence(4, 4)).toBe(1);
  });
});

describe("applySessionCompletedToRhythmPriors", () => {
  it("increments slot samples and merges top products", () => {
    const updated = applySessionCompletedToRhythmPriors(emptyLocationRhythmPriors(), {
      slotKey: "5:20",
      localDow: 5,
      localHour: 20,
      durationMin: 55,
      dessertDelayMin: 22,
      revenue: 120,
      topProducts: [
        { productId: "a", name: "Steak", count: 1 },
        { productId: "b", name: "Wine", count: 2 },
      ],
      servicePeriod: "dinner",
    });

    const slot = updated.slots["5:20"];
    expect(slot?.sampleSessions).toBe(1);
    expect(slot?.sessionDurationP50Min).toBe(55);
    expect(slot?.dessertDelayP50Min).toBe(22);
    expect(slot?.revenueEma).toBe(120);
    expect(slot?.topProducts).toHaveLength(2);
  });
});

describe("buildWelcomeMessage rhythm copy (VRP-P2)", () => {
  it("includes slot top product when provided", async () => {
    const { buildWelcomeMessage } = await import(
      "@/lib/denis/cognition/proactive/proactive-message-builders"
    );
    const message = buildWelcomeMessage(
      "Skyline",
      "sr",
      null,
      "fallback",
      "Beef Burger"
    );
    expect(message).toContain("Beef Burger");
    expect(message).toContain("favorit");
  });
});
