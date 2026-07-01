import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
import { foldProductNudgeStats } from "@/lib/denis/cognition/offer/fold-product-nudge-stats";
import {
  buildOfferConvertedPayload,
  findNewOfferConversions,
} from "@/lib/denis/cognition/offer/offer-conversion-timeline";
import { offerConversionDedupeKey } from "@/lib/denis/cognition/offer/offer-conversion-types";
import { scoreBrowseProducts } from "@/lib/denis/cognition/offer/score-browse-products";
import { browseRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const BURGER = "11111111-1111-4111-8111-111111111111";
const PASTA = "33333333-3333-4333-8333-333333333333";
const EMIT_AT = "2026-06-07T12:20:00.000Z";
const CART_AT = "2026-06-07T12:22:30.000Z";
const LATE_CART_AT = "2026-06-07T12:40:00.000Z";

function proactiveEmittedRow(
  seq: number,
  at: string,
  productId: string,
  productName: string
): DenisTimelineRow {
  return {
    id: `emit-${seq}`,
    ai_session_id: "ai-session-1",
    seq,
    event_type: "proactive.emitted",
    payload: {
      type: "proactive.emitted",
      kind: "browse_nudge",
      message: `Hoćete ${productName}?`,
      orderId: null,
      tier: "template",
      productId,
      productName,
      offerResolution: "top_dwell",
    },
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: at,
  };
}

describe("foldOfferConversions", () => {
  it("matches proactive emit to add_to_cart within window", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
    ];

    const conversions = foldOfferConversions(timeline);
    expect(conversions).toHaveLength(1);
    expect(conversions[0]).toMatchObject({
      productId: BURGER,
      productName: "Beef Burger",
      nudgeKind: "browse_nudge",
      offerResolution: "top_dwell",
      emittedAt: EMIT_AT,
      convertedAt: CART_AT,
      lagSeconds: 150,
    });
  });

  it("ignores cart adds outside conversion window", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: LATE_CART_AT,
      }),
    ];

    expect(foldOfferConversions(timeline)).toHaveLength(0);
  });

  it("ignores proactive emits without productId", () => {
    const row = proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger");
    const payload = row.payload as Record<string, unknown>;
    delete payload.productId;

    const timeline = [
      row,
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
    ];

    expect(foldOfferConversions(timeline)).toHaveLength(0);
  });
});

describe("foldProductNudgeStats", () => {
  it("counts impressions and accepts per product", () => {
    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      proactiveEmittedRow(2, "2026-06-07T12:21:00.000Z", PASTA, "Pasta"),
      browseRow(3, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
    ];

    const conversions = foldOfferConversions(timeline);
    const stats = foldProductNudgeStats(timeline, conversions);

    expect(stats.get(BURGER)).toEqual({ impressions: 1, accepts: 1 });
    expect(stats.get(PASTA)).toEqual({ impressions: 1, accepts: 0 });
  });
});

describe("findNewOfferConversions", () => {
  it("skips conversions already logged on timeline", () => {
    const conversion = foldOfferConversions([
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
    ])[0]!;

    const timeline = [
      proactiveEmittedRow(1, EMIT_AT, BURGER, "Beef Burger"),
      browseRow(2, {
        action: "add_to_cart",
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        menuSection: "food",
        timestamp: CART_AT,
      }),
      {
        id: "converted-1",
        ai_session_id: "ai-session-1",
        seq: 3,
        event_type: "offer.converted",
        payload: buildOfferConvertedPayload(conversion),
        trace_id: "trace-3",
        context_hash: null,
        created_at: CART_AT,
      },
    ];

    expect(findNewOfferConversions(timeline)).toHaveLength(0);
    expect(offerConversionDedupeKey(conversion)).toBe(`${BURGER}:${EMIT_AT}`);
  });
});

describe("scoreBrowseProducts M16 boost", () => {
  const nowMs = Date.parse("2026-06-07T12:30:00.000Z");
  const browse = {
    ...emptyBrowseProfile(),
    viewedProducts: [
      {
        productId: BURGER,
        productName: "Beef Burger",
        categoryPath: ["food"],
        viewCount: 2,
        totalDwellMs: 18_000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
      },
      {
        productId: PASTA,
        productName: "Pasta",
        categoryPath: ["food"],
        viewCount: 2,
        totalDwellMs: 18_000,
        addedToCart: false,
        removedFromCart: false,
        disposition: "viewed" as const,
      },
    ],
  };

  it("excludes converted products from scoring", () => {
    const scored = scoreBrowseProducts({
      browse,
      timeline: [],
      mental: emptyGuestMentalModel(nowMs),
      sequencePattern: "decisive",
      nowMs,
      convertedProductIds: new Set([BURGER]),
    });

    expect(scored.map((row) => row.productId)).toEqual([PASTA]);
  });

  it("boosts products with higher nudge accept rate", () => {
    const baseInput = {
      browse,
      timeline: [],
      mental: emptyGuestMentalModel(nowMs),
      sequencePattern: "decisive" as const,
      nowMs,
    };

    const withoutStats = scoreBrowseProducts(baseInput);
    const withStats = scoreBrowseProducts({
      ...baseInput,
      nudgeStats: new Map([
        [BURGER, { impressions: 4, accepts: 3 }],
        [PASTA, { impressions: 4, accepts: 0 }],
      ]),
    });

    const burgerBase = withoutStats.find((row) => row.productId === BURGER)!.score;
    const burgerBoosted = withStats.find((row) => row.productId === BURGER)!.score;
    const pastaBoosted = withStats.find((row) => row.productId === PASTA)!.score;

    expect(burgerBoosted).toBeGreaterThan(burgerBase);
    expect(burgerBoosted).toBeGreaterThan(pastaBoosted);
  });
});
