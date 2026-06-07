import type { OfferResolutionKind } from "@/lib/denis/cognition/offer/offer-types";

/** Proactive nudge → cart add within conversion window (GMM-12). */
export const OFFER_CONVERSION_WINDOW_SEC = 600;

export type OfferConversionRecord = {
  productId: string;
  productName: string | null;
  nudgeKind: string;
  offerResolution: OfferResolutionKind | null;
  emittedAt: string;
  convertedAt: string;
  lagSeconds: number;
};

export type ProductNudgeStats = {
  impressions: number;
  accepts: number;
};

export function offerConversionDedupeKey(conversion: OfferConversionRecord): string {
  return `${conversion.productId}:${conversion.emittedAt}`;
}
