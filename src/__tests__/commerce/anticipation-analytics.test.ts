import { describe, expect, it } from "vitest";
import { COMMERCE_EVENT_TYPES } from "@/lib/commerce/event-types";
import { anticipationRollupDelta } from "@/lib/commerce/projections/rollup-anticipation-analytics";

describe("anticipationRollupDelta", () => {
  it("counts nudge impressions by kind", () => {
    const delta = anticipationRollupDelta({
      orgId: "org-1",
      locationId: "loc-1",
      eventType: COMMERCE_EVENT_TYPES.nudgeEmitted,
      createdAt: "2026-06-07T14:22:00.000Z",
      payload: { nudgeKind: "browse_nudge" },
    });

    expect(delta.nudgeImpressions).toBe(1);
    expect(delta.offerConversions).toBe(0);
    expect(delta.byNudgeKind).toEqual({ browse_nudge: 1 });
    expect(delta.metricDate).toBe("2026-06-07");
  });

  it("counts offer conversions with lag and resolution", () => {
    const delta = anticipationRollupDelta({
      orgId: "org-1",
      locationId: "loc-1",
      eventType: COMMERCE_EVENT_TYPES.offerConverted,
      createdAt: "2026-06-07T15:00:00.000Z",
      payload: {
        nudgeKind: "browse_nudge",
        offerResolution: "top_dwell",
        lagSeconds: 150,
      },
    });

    expect(delta.offerConversions).toBe(1);
    expect(delta.conversionLagSeconds).toBe(150);
    expect(delta.byOfferResolution).toEqual({ top_dwell: 1 });
  });
});
