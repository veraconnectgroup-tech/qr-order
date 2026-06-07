import { foldOfferConversions } from "@/lib/denis/cognition/offer/fold-offer-conversions";
import type {
  OfferConversionRecord,
  ProductNudgeStats,
} from "@/lib/denis/cognition/offer/offer-conversion-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Per-product nudge impressions/accepts from timeline (M16 session slice). */
export function foldProductNudgeStats(
  timeline: DenisTimelineRow[],
  conversions: OfferConversionRecord[] = foldOfferConversions(timeline)
): Map<string, ProductNudgeStats> {
  const stats = new Map<string, ProductNudgeStats>();

  for (const row of timeline) {
    if (row.event_type !== "proactive.emitted") continue;
    const payload = asRecord(row.payload);
    const productId = payload.productId;
    if (typeof productId !== "string" || !productId.trim()) continue;

    const entry = stats.get(productId) ?? { impressions: 0, accepts: 0 };
    entry.impressions += 1;
    stats.set(productId, entry);
  }

  for (const conversion of conversions) {
    const entry = stats.get(conversion.productId) ?? { impressions: 0, accepts: 0 };
    entry.accepts += 1;
    stats.set(conversion.productId, entry);
  }

  return stats;
}
