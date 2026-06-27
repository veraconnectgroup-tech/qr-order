import { describe, expect, it } from "vitest";
import {
  denisTurnDailyDelta,
  mergeNudgeRevenueMaps,
} from "@/lib/commerce/projections/rollup-denis-roi-daily";

describe("denisTurnDailyDelta", () => {
  it("counts T0 turns without AI cost", () => {
    const delta = denisTurnDailyDelta({
      orgId: "org-1",
      locationId: "loc-1",
      createdAt: "2026-06-07T12:00:00.000Z",
      llmUsed: false,
      creditsCharged: 0,
    });

    expect(delta.t0Turns).toBe(1);
    expect(delta.llmTurns).toBe(0);
    expect(delta.aiCostCents).toBe(0);
  });

  it("counts LLM turns with credit cost", () => {
    const delta = denisTurnDailyDelta({
      orgId: "org-1",
      locationId: "loc-1",
      createdAt: "2026-06-07T12:00:00.000Z",
      llmUsed: true,
      creditsCharged: 1,
    });

    expect(delta.llmTurns).toBe(1);
    expect(delta.aiCostCents).toBeGreaterThan(0);
  });
});

describe("mergeNudgeRevenueMaps", () => {
  it("merges category revenue across events", () => {
    const merged = mergeNudgeRevenueMaps(
      { dessert_upsell: { accepted: 2, revenue: 16 } },
      { dessert_upsell: { accepted: 1, revenue: 8 }, drink_pairing: { accepted: 1, revenue: 3 } }
    );

    expect(merged.dessert_upsell).toEqual({ accepted: 3, revenue: 24 });
    expect(merged.drink_pairing).toEqual({ accepted: 1, revenue: 3 });
  });
});
