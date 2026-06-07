import { describe, expect, it } from "vitest";
import { buildWeeklyNudgeDigest } from "@/lib/admin/build-weekly-nudge-digest";
import type { NudgePerformanceSnapshot } from "@/lib/admin/load-nudge-performance";
import { aggregateProductNudgeStatsFromTimelines } from "@/lib/denis/learning/aggregate-product-nudge-stats";
import { browseRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const BURGER = "11111111-1111-4111-8111-111111111111";
const EMIT_AT = "2026-06-07T12:20:00.000Z";
const CART_AT = "2026-06-07T12:22:30.000Z";

function proactiveRow(productId: string, productName: string): DenisTimelineRow {
  return {
    id: "emit-1",
    ai_session_id: "ai-1",
    seq: 1,
    event_type: "proactive.emitted",
    payload: {
      type: "proactive.emitted",
      kind: "browse_nudge",
      message: productName,
      orderId: null,
      tier: "template",
      productId,
      productName,
    },
    trace_id: "trace-1",
    context_hash: null,
    created_at: EMIT_AT,
  };
}

describe("aggregateProductNudgeStatsFromTimelines", () => {
  it("ranks products by accept rate", () => {
    const stats = aggregateProductNudgeStatsFromTimelines([
      [
        proactiveRow(BURGER, "Beef Burger"),
        browseRow(2, {
          action: "add_to_cart",
          productId: BURGER,
          productName: "Beef Burger",
          categoryPath: ["food"],
          menuSection: "food",
          timestamp: CART_AT,
        }),
      ],
    ]);

    expect(stats[0]).toMatchObject({
      productId: BURGER,
      impressions: 1,
      accepts: 1,
      acceptRate: 1,
    });
  });
});

describe("buildWeeklyNudgeDigest", () => {
  const snapshot: NudgePerformanceSnapshot = {
    locationId: "loc-1",
    locationName: "Skyline Lounge",
    periodDays: 7,
    fromDate: "2026-06-01",
    toDate: "2026-06-07",
    nudgeImpressions: 234,
    offerConversions: 78,
    conversionRate: 78 / 234,
    nudgeDeclined: 90,
    nudgeIgnored: 40,
    nudgeExpired: 26,
    byNudgeKind: { browse_nudge: 180, dessert_nudge: 54 },
    byOutcome: { accepted: 78, declined: 90, ignored: 40, expired: 26 },
    topProducts: [
      {
        productId: BURGER,
        productName: "Beef Burger",
        impressions: 40,
        accepts: 21,
        acceptRate: 0.525,
      },
    ],
    suggestedAction: 'Nastavi browse nudge za "Beef Burger" (53% accept).',
  };

  it("builds subject and body with key metrics", () => {
    const digest = buildWeeklyNudgeDigest(snapshot);

    expect(digest.subject).toContain("Skyline Lounge");
    expect(digest.text).toContain("234 nudge-ova");
    expect(digest.text).toContain("78");
    expect(digest.text).toContain("Beef Burger");
    expect(digest.html).toContain("33%");
  });
});
