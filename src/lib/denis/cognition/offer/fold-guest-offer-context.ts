import { createHash } from "node:crypto";

import { detectBrowseSequencePattern } from "@/lib/denis/cognition/offer/detect-browse-sequence-pattern";
import { computeOfferTiming, mapTimingToReadiness } from "@/lib/denis/cognition/offer/compute-offer-timing";
import { foldBrowseSequence } from "@/lib/denis/cognition/offer/fold-browse-sequence";
import { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import {
  foldNudgeRevenueAttribution,
  sumAttributedNudgeRevenueCents,
} from "@/lib/denis/cognition/offer/fold-nudge-revenue";
import { foldProductNudgeStats } from "@/lib/denis/cognition/offer/fold-product-nudge-stats";
import {
  GUEST_OFFER_CONTEXT_VERSION,
  type FoldGuestOfferContextInput,
  type GuestOfferContext,
} from "@/lib/denis/cognition/offer/offer-types";
import { resolveOfferForPosture } from "@/lib/denis/cognition/offer/resolve-offer-for-posture";
import {
  buildProductAllergensFromVkg,
  buildProductPricesFromTimeline,
  countCartRecoveryEmits,
  resolveSmartCartRecoveryOffer,
} from "@/lib/denis/cognition/offer/smart-cart-recovery";
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
  const nudgeLifecycle = foldNudgeOutcomes(input.timeline, now);
  const nudgeStats = foldProductNudgeStats(input.timeline, conversions);
  const orderLines = (input.orders ?? []).flatMap((order) =>
    order.items
      .filter((item) => item.productId)
      .map((item) => ({
        orderId: order.id,
        orderItemId: item.orderItemId,
        productId: item.productId!,
        lineTotalCents: item.lineTotalCents ?? 0,
        createdAt: order.createdAt,
      }))
  );
  const attributedRevenue = foldNudgeRevenueAttribution({
    outcomes: nudgeLifecycle.outcomes,
    orderLines,
  });
  const attributedRevenueCents = sumAttributedNudgeRevenueCents(attributedRevenue);
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

  const timing = computeOfferTiming({
    sequence,
    browse: input.browse,
    mental: input.mental,
    cartLineCount: input.cartLineCount,
    nowMs: now,
  });

  const readiness = mapTimingToReadiness(timing);

  const resolved = resolveOfferForPosture({
    mental: input.mental,
    browse: input.browse,
    scoredProducts,
    readiness,
    sequencePattern,
    venueOps: input.venueOps,
  });

  const cartRecoveryEmitCount = countCartRecoveryEmits({
    outcomes: nudgeLifecycle.outcomes,
    pending: nudgeLifecycle.pending,
  });

  const smartRecoveryResult =
    input.browse.cartAbandoned.length > 0
      ? resolveSmartCartRecoveryOffer({
          browse: input.browse,
          mental: input.mental,
          sequence,
          sequencePattern,
          readiness,
          cartRecoveryEmitCount,
          productPricesCents:
            input.productPricesCents ??
            buildProductPricesFromTimeline(input.timeline),
          sessionAllergieLabels: input.sessionAllergieLabels,
          productAllergens:
            input.productAllergens ?? buildProductAllergensFromVkg(input.vkgGraph),
          vkgGraph: input.vkgGraph,
          language: input.language ?? input.config.language?.venueDefault ?? null,
          nowMs: now,
          isKitchenBlocked: input.venueOps.kdsStress === "high",
        })
      : null;

  const finalPrimary = smartRecoveryResult?.primary ?? resolved.primary;
  const finalAlternative = smartRecoveryResult?.alternative ?? resolved.alternative;
  const finalCartRecovery = smartRecoveryResult?.cartRecovery ?? resolved.cartRecovery;
  const finalStrategy = smartRecoveryResult?.strategy ?? resolved.strategy;
  const finalReadiness = smartRecoveryResult?.readiness ?? readiness;
  const smartRecovery = smartRecoveryResult?.plan ?? null;

  const topDwellMs = input.browse.viewedProducts[0]?.totalDwellMs ?? 0;

  const withoutHash = {
    version: GUEST_OFFER_CONTEXT_VERSION,
    readiness: finalReadiness,
    primary: finalPrimary,
    alternative: finalAlternative,
    cartRecovery: finalCartRecovery,
    smartRecovery,
    sequencePattern,
    scoredProducts,
    trace: {
      strategy: finalStrategy,
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
      readiness: finalReadiness,
      timing,
      conversions,
      nudgeStats: nudgeStatsRecord,
      outcomes: nudgeLifecycle.outcomes,
      pendingNudges: nudgeLifecycle.pending,
      sessionAttachRate: nudgeLifecycle.sessionAttachRate,
      attributedRevenue,
      attributedRevenueCents,
    },
  };

  return {
    ...withoutHash,
    computedAt: now,
    hash: computeOfferHash(withoutHash),
  };
}
