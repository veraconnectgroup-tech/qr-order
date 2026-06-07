import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type {
  BrowseSequencePattern,
  ScoredBrowseProduct,
} from "@/lib/denis/cognition/offer/offer-types";
import type { ProductNudgeStats } from "@/lib/denis/cognition/offer/offer-conversion-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";

const WEIGHTS = {
  dwell: 0.35,
  viewCount: 0.15,
  recency: 0.2,
  returnView: 0.15,
  cartIntent: 0.1,
  sequence: 0.05,
} as const;

function isBrowseEvent(row: DenisTimelineRow): BrowseEvent | null {
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { type?: string }).type !== "perception.ingested") return null;
  const frame = (payload as { frame?: { channel?: string } }).frame;
  if (frame?.channel !== "telemetry.browse") return null;
  const event = (payload as { browseEvent?: BrowseEvent }).browseEvent;
  if (!event || typeof event !== "object") return null;
  return event;
}

function lastViewedAtByProduct(timeline: DenisTimelineRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of timeline) {
    const event = isBrowseEvent(row);
    if (!event?.productId || event.action !== "view_product") continue;
    map.set(event.productId, event.timestamp || row.created_at);
  }
  return map;
}

function dwellWeight(totalDwellMs: number, maxDwellInSession: number): number {
  if (maxDwellInSession <= 0) return 0;
  const ratio = totalDwellMs / maxDwellInSession;
  return Math.min(1, Math.log1p(ratio * 9) / Math.log1p(9));
}

function recencyWeight(lastViewedAt: string, nowMs: number): number {
  const ageSec = (nowMs - new Date(lastViewedAt).getTime()) / 1000;
  if (ageSec <= 30) return 1;
  if (ageSec <= 120) return 0.7;
  if (ageSec <= 300) return 0.4;
  return 0.1;
}

function sequenceBoost(
  product: GuestBrowseProfile["viewedProducts"][0],
  pattern: BrowseSequencePattern
): number {
  switch (pattern) {
    case "decisive":
    case "return_view":
      return product.viewCount >= 2 ? 1 : 0.5;
    case "price_sensitive":
      return product.addedToCart ? 0.8 : 0.3;
    default:
      return 0.5;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function nudgeAcceptRate(impressions: number, accepts: number): number {
  if (impressions <= 0) return 0;
  return Math.min(1, accepts / impressions);
}

/** Mirrors M16 suggestedWeightFromAcceptRate — kept local for layer compliance. */
function nudgeWeightFromAcceptRate(rate: number): number {
  return Math.min(1, Math.max(0.1, Number(rate.toFixed(4))));
}

export function scoreBrowseProducts(input: {
  browse: GuestBrowseProfile;
  timeline: DenisTimelineRow[];
  mental: GuestMentalModel;
  sequencePattern: BrowseSequencePattern;
  nowMs: number;
  nudgeStats?: Map<string, ProductNudgeStats>;
  convertedProductIds?: Set<string>;
}): ScoredBrowseProduct[] {
  const lastViewed = lastViewedAtByProduct(input.timeline);
  const maxDwell = Math.max(
    ...input.browse.viewedProducts.map((product) => product.totalDwellMs),
    0
  );

  const scored = input.browse.viewedProducts
    .filter(
      (product) =>
        !(product.addedToCart && !product.removedFromCart) &&
        !input.convertedProductIds?.has(product.productId)
    )
    .map((product) => {
      const factors = {
        dwellWeight: dwellWeight(product.totalDwellMs, maxDwell),
        viewCountWeight: Math.min(1, product.viewCount / 3),
        recencyWeight: recencyWeight(
          lastViewed.get(product.productId) ?? new Date(input.nowMs).toISOString(),
          input.nowMs
        ),
        returnViewBoost: product.viewCount >= 2 ? 1 : 0,
        cartIntentBoost:
          product.addedToCart && !product.removedFromCart ? 1 : 0,
        sequenceBoost: sequenceBoost(product, input.sequencePattern),
      };

      let score =
        factors.dwellWeight * WEIGHTS.dwell +
        factors.viewCountWeight * WEIGHTS.viewCount +
        factors.recencyWeight * WEIGHTS.recency +
        factors.returnViewBoost * WEIGHTS.returnView +
        factors.cartIntentBoost * WEIGHTS.cartIntent +
        factors.sequenceBoost * WEIGHTS.sequence;

      if (input.mental.pace === "relaxed") score *= 1.1;
      if (input.mental.receptiveness === "enthusiastic") score *= 1.15;
      if (input.mental.pace === "rushed") score *= 0.85;

      const nudgeStat = input.nudgeStats?.get(product.productId);
      if (nudgeStat && nudgeStat.impressions > 0) {
        const rate = nudgeAcceptRate(nudgeStat.impressions, nudgeStat.accepts);
        score *= 1 + nudgeWeightFromAcceptRate(rate) * 0.2;
      }

      return {
        ...product,
        score: clamp01(score),
        lastViewedAt:
          lastViewed.get(product.productId) ??
          new Date(input.nowMs).toISOString(),
      };
    });

  return scored.sort((a, b) => b.score - a.score);
}
