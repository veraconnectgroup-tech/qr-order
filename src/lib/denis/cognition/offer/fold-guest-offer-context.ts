import { createHash } from "node:crypto";

import { detectBrowseSequencePattern } from "@/lib/denis/cognition/offer/detect-browse-sequence-pattern";
import { deriveOfferReadiness } from "@/lib/denis/cognition/offer/derive-offer-readiness";
import { foldBrowseSequence } from "@/lib/denis/cognition/offer/fold-browse-sequence";
import { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
import { foldProductNudgeStats } from "@/lib/denis/cognition/offer/fold-product-nudge-stats";
import {
  GUEST_OFFER_CONTEXT_VERSION,
  type FoldGuestOfferContextInput,
  type GuestOfferContext,
} from "@/lib/denis/cognition/offer/offer-types";
import { resolveOfferForPosture } from "@/lib/denis/cognition/offer/resolve-offer-for-posture";
import { scoreBrowseProducts } from "@/lib/denis/cognition/offer/score-browse-products";

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (v as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return v;
  });
}

function computeOfferHash(
  model: Omit<GuestOfferContext, "hash" | "computedAt">
): string {
  return createHash("sha256").update(stableSerialize(model)).digest("hex").slice(0, 16);
}

/** Pure fold — guest offer resolution (ADR-038 GMM-9). */
export function foldGuestOfferContext(
  input: FoldGuestOfferContextInput
): GuestOfferContext {
  const now = input.now ?? Date.now();
  const sequence = foldBrowseSequence(input.timeline);
  const sequencePattern = detectBrowseSequencePattern(sequence);
  const conversions = foldOfferConversions(input.timeline);
  const nudgeStats = foldProductNudgeStats(input.timeline, conversions);
  const convertedProductIds = new Set(conversions.map((row) => row.productId));
  const nudgeStatsRecord = Object.fromEntries(nudgeStats.entries());

  const scoredProducts = scoreBrowseProducts({
    browse: input.browse,
    timeline: input.timeline,
    mental: input.mental,
    sequencePattern,
    nowMs: now,
    nudgeStats,
    convertedProductIds,
  });

  const readiness = deriveOfferReadiness({
    spine: input.spine,
    browse: input.browse,
    mental: input.mental,
    cartLineCount: input.cartLineCount,
    nowMs: now,
  });

  const resolved = resolveOfferForPosture({
    mental: input.mental,
    browse: input.browse,
    scoredProducts,
    readiness,
    sequencePattern,
    venueOps: input.venueOps,
  });

  const topDwellMs = input.browse.viewedProducts[0]?.totalDwellMs ?? 0;

  const withoutHash = {
    version: GUEST_OFFER_CONTEXT_VERSION,
    readiness,
    primary: resolved.primary,
    alternative: resolved.alternative,
    cartRecovery: resolved.cartRecovery,
    sequencePattern,
    scoredProducts,
    trace: {
      strategy: resolved.strategy,
      posture: {
        predictedNeed: input.mental.predictedNeed,
        intent: input.mental.intent,
        pace: input.mental.pace,
        priceAffinity: input.mental.priceAffinity,
      },
      browse: {
        topProductId: scoredProducts[0]?.productId ?? null,
        topDwellMs,
        sequencePattern,
        cartAbandonedCount: input.browse.cartAbandoned.length,
      },
      venue: {
        kdsStress: input.venueOps.kdsStress,
        operatingMode: input.venueOps.operatingMode,
      },
      readiness,
      conversions,
      nudgeStats: nudgeStatsRecord,
    },
  };

  return {
    ...withoutHash,
    computedAt: now,
    hash: computeOfferHash(withoutHash),
  };
}
