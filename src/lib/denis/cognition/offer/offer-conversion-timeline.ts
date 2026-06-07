import { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
import {
  offerConversionDedupeKey,
  type OfferConversionRecord,
} from "@/lib/denis/cognition/offer/offer-conversion-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type OfferConvertedPayload = {
  type: "offer.converted";
  productId: string;
  productName: string | null;
  nudgeKind: string;
  offerResolution: string | null;
  emittedAt: string;
  convertedAt: string;
  lagSeconds: number;
  dedupeKey: string;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function extractLoggedOfferConversionKeys(
  timeline: DenisTimelineRow[]
): Set<string> {
  const keys = new Set<string>();
  for (const row of timeline) {
    if (row.event_type !== "offer.converted") continue;
    const payload = asRecord(row.payload);
    if (payload.type !== "offer.converted") continue;
    const dedupeKey = payload.dedupeKey;
    if (typeof dedupeKey === "string" && dedupeKey.trim()) {
      keys.add(dedupeKey);
    }
  }
  return keys;
}

export function findNewOfferConversions(
  timeline: DenisTimelineRow[]
): OfferConversionRecord[] {
  const logged = extractLoggedOfferConversionKeys(timeline);
  return foldOfferConversions(timeline).filter(
    (conversion) => !logged.has(offerConversionDedupeKey(conversion))
  );
}

export function buildOfferConvertedPayload(
  conversion: OfferConversionRecord
): OfferConvertedPayload {
  return {
    type: "offer.converted",
    productId: conversion.productId,
    productName: conversion.productName,
    nudgeKind: conversion.nudgeKind,
    offerResolution: conversion.offerResolution,
    emittedAt: conversion.emittedAt,
    convertedAt: conversion.convertedAt,
    lagSeconds: conversion.lagSeconds,
    dedupeKey: offerConversionDedupeKey(conversion),
  };
}
