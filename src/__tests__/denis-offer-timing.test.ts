import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { computeOfferTiming } from "@/lib/denis/cognition/offer/compute-offer-timing";
import { deriveOfferReadiness } from "@/lib/denis/cognition/offer/derive-offer-readiness";
import {
  browsePauseOpenBeyondLegacyCap,
  violatesNeedsHelpTimingBlock,
} from "@/lib/denis/cognition/offer/offer-timing-invariants";
import type { BrowseSequenceEntry } from "@/lib/denis/cognition/offer/offer-types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const NOW_MS = 1_700_000_000_000;

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW_MS - seconds * 1000).toISOString();
}

function viewSequence(idleSec: number): BrowseSequenceEntry[] {
  return [
    {
      at: isoSecondsAgo(idleSec),
      action: "view_product",
      productId: PRODUCT_ID,
      menuSection: "food",
    },
  ];
}

function mentalNeedsHelp() {
  return {
    ...emptyGuestMentalModel(NOW_MS),
    intent: "exploring" as const,
    predictedNeed: "needs_help_choosing" as const,
    receptiveness: "open" as const,
    confidence: 0.85,
  };
}

describe("computeOfferTiming (ADR-040 UPDS)", () => {
  it("T1 timing_needs_help_browse_pause_speaks at 12s idle", () => {
    const timing = computeOfferTiming({
      sequence: viewSequence(12),
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: PRODUCT_ID,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
          },
        ],
      },
      mental: mentalNeedsHelp(),
      cartLineCount: 0,
      nowMs: NOW_MS,
    });

    expect(timing.ready).toBe(true);
    expect(timing.kind).toBe("browse_pause");
    expect(timing.reason).toBe("browse_pause");
    expect(violatesNeedsHelpTimingBlock(timing, mentalNeedsHelp())).toBe(false);
  });

  it("T3 browse_pause stays open beyond legacy 20s cap with needs_help", () => {
    const timing = computeOfferTiming({
      sequence: viewSequence(45),
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: PRODUCT_ID,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
          },
        ],
      },
      mental: mentalNeedsHelp(),
      cartLineCount: 0,
      nowMs: NOW_MS,
    });

    expect(browsePauseOpenBeyondLegacyCap(timing, 45)).toBe(true);
    expect(timing.ready).toBe(true);
    expect(timing.speakWindow).toBe("open");
  });

  it("T2 uses view_product clock — recent chat does not reset browse idle", () => {
    const timing = computeOfferTiming({
      sequence: viewSequence(12),
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: PRODUCT_ID,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
          },
        ],
      },
      mental: mentalNeedsHelp(),
      cartLineCount: 0,
      nowMs: NOW_MS,
    });

    expect(timing.idleSinceBrowseSec).toBeCloseTo(12, 0);
    expect(timing.ready).toBe(true);
  });

  it("blocks wants_bill posture for offer timing", () => {
    const timing = computeOfferTiming({
      sequence: viewSequence(12),
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: PRODUCT_ID,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
          },
        ],
      },
      mental: {
        ...mentalNeedsHelp(),
        predictedNeed: "wants_bill",
        mealStage: "paying",
      },
      cartLineCount: 0,
      nowMs: NOW_MS,
    });

    expect(timing.ready).toBe(false);
    expect(timing.speakWindow).toBe("closed");
  });

  it("deriveOfferReadiness adapter mirrors timing", () => {
    const readiness = deriveOfferReadiness({
      sequence: viewSequence(12),
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: PRODUCT_ID,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
            disposition: "viewed",
          },
        ],
      },
      mental: mentalNeedsHelp(),
      cartLineCount: 0,
      nowMs: NOW_MS,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.reason).toBe("browse_pause");
    expect(readiness.secondsSinceLastBrowseAction).toBeCloseTo(12, 0);
  });
});
