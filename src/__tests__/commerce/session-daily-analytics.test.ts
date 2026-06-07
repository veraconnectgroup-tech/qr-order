import { describe, expect, it } from "vitest";
import { COMMERCE_EVENT_TYPES } from "@/lib/commerce/event-types";
import { sessionCompletedDailyDelta } from "@/lib/commerce/projections/rollup-session-daily-analytics";
import {
  buildHeatmapFromPriors,
  computeComparativeTrend,
  computeRevpash,
} from "@/lib/admin/load-venue-rhythm-admin";

describe("sessionCompletedDailyDelta", () => {
  it("counts session close and revenue", () => {
    const delta = sessionCompletedDailyDelta({
      orgId: "org-1",
      locationId: "loc-1",
      eventType: COMMERCE_EVENT_TYPES.sessionCompleted,
      createdAt: "2026-06-07T19:30:00.000Z",
      payload: { revenue: 84.5 },
    });

    expect(delta).toEqual({
      metricDate: "2026-06-07",
      sessionsClosed: 1,
      sessionRevenueTotal: 84.5,
    });
  });
});

describe("venue rhythm admin helpers", () => {
  it("computes RevPASH per seat-hour", () => {
    expect(computeRevpash(120, 40)).toBe(3);
    expect(computeRevpash(null, 40)).toBeNull();
  });

  it("builds heatmap cells from priors", () => {
    const heatmap = buildHeatmapFromPriors({
      priors: {
        version: 1,
        slots: {
          "5:20": {
            sampleSessions: 10,
            sessionDurationP50Min: 55,
            dessertDelayP50Min: 18,
            revenueEma: 200,
            topProducts: [{ productId: "p1", name: "Steak", count: 5 }],
            servicePeriod: "dinner",
          },
        },
      },
      totalSeats: 50,
      minSampleSessions: 8,
    });

    expect(heatmap).toHaveLength(1);
    expect(heatmap[0]?.revpash).toBe(4);
    expect(heatmap[0]?.topProductName).toBe("Steak");
  });

  it("labels comparative trend", () => {
    expect(
      computeComparativeTrend({
        recentSessions: 70,
        recentDays: 7,
        baselineSessionsPerDay: 8,
      })
    ).toBe("up");
  });
});
