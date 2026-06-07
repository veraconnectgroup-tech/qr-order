import { describe, expect, it } from "vitest";
import { foldNudgeRevenueAttribution } from "@/lib/denis/cognition/offer/fold-nudge-revenue";
import { aggregateNudgeEdgeStats } from "@/lib/denis/learning/compute-nudge-edge-stats";
import { browseRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const ANCHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DESSERT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMIT_AT = "2026-06-07T12:20:00.000Z";
const ORDER_AT = "2026-06-07T12:23:00.000Z";

function proactiveEmittedRow(
  at: string,
  productId: string,
  productName: string
): DenisTimelineRow {
  return {
    id: "emit-1",
    ai_session_id: "ai-1",
    seq: 1,
    event_type: "proactive.emitted",
    payload: {
      type: "proactive.emitted",
      kind: "dessert_nudge",
      message: productName,
      orderId: null,
      tier: "template",
      productId,
      productName,
    },
    trace_id: "trace-1",
    context_hash: null,
    created_at: at,
  };
}

describe("foldNudgeRevenueAttribution", () => {
  it("matches accepted outcome to order line within attribution window", () => {
    const attributed = foldNudgeRevenueAttribution({
      outcomes: [
        {
          nudgeId: "dessert_nudge:1",
          nudgeKind: "dessert_nudge",
          outcome: "accepted",
          signal: "add_to_cart",
          productId: DESSERT,
          productName: "Cheesecake",
          offerResolution: null,
          emittedAt: EMIT_AT,
          resolvedAt: ORDER_AT,
          lagMs: 180_000,
        },
      ],
      orderLines: [
        {
          orderId: "order-1",
          orderItemId: "item-1",
          productId: DESSERT,
          lineTotalCents: 890,
          createdAt: ORDER_AT,
        },
      ],
    });

    expect(attributed).toHaveLength(1);
    expect(attributed[0]?.grossCents).toBe(890);
  });
});

describe("aggregateNudgeEdgeStats", () => {
  it("aggregates anchor→nudged product impressions and accepts", () => {
    const timeline = [
      proactiveEmittedRow(EMIT_AT, DESSERT, "Cheesecake"),
      browseRow(2, {
        action: "add_to_cart",
        productId: DESSERT,
        productName: "Cheesecake",
        categoryPath: ["desserts"],
        menuSection: "desserts",
        timestamp: ORDER_AT,
      }),
    ];

    const stats = aggregateNudgeEdgeStats([
      { anchorProductId: ANCHOR, timeline },
    ]);

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      fromProductId: ANCHOR,
      toProductId: DESSERT,
      nudgeKind: "dessert_nudge",
      impressions: 1,
      accepts: 1,
    });
  });
});
