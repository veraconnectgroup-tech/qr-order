import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import {
  OFFER_CONVERSION_WINDOW_SEC,
  type OfferConversionRecord,
} from "@/lib/denis/cognition/offer/offer-conversion-types";
import type { OfferResolutionKind } from "@/lib/denis/cognition/offer/offer-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

type PendingEmit = {
  productId: string;
  productName: string | null;
  nudgeKind: string;
  offerResolution: OfferResolutionKind | null;
  emittedAt: string;
  emittedMs: number;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

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

function readResolution(value: unknown): OfferResolutionKind | null {
  if (typeof value !== "string") return null;
  const allowed: OfferResolutionKind[] = [
    "top_dwell",
    "return_view",
    "cart_recovery",
    "kitchen_alternative",
    "category_affinity",
  ];
  return allowed.includes(value as OfferResolutionKind)
    ? (value as OfferResolutionKind)
    : null;
}

/** Match proactive.emitted productId → add_to_cart within window (pure fold). */
export function foldOfferConversions(
  timeline: DenisTimelineRow[],
  windowSec = OFFER_CONVERSION_WINDOW_SEC
): OfferConversionRecord[] {
  const conversions: OfferConversionRecord[] = [];
  const pendingByProduct = new Map<string, PendingEmit[]>();

  for (const row of timeline) {
    const atMs = new Date(row.created_at).getTime();

    if (row.event_type === "proactive.emitted") {
      const payload = asRecord(row.payload);
      const productId = payload.productId;
      if (typeof productId !== "string" || !productId.trim()) continue;

      const queue = pendingByProduct.get(productId) ?? [];
      queue.push({
        productId,
        productName:
          typeof payload.productName === "string" ? payload.productName : null,
        nudgeKind: String(payload.kind ?? "browse_nudge"),
        offerResolution: readResolution(payload.offerResolution),
        emittedAt: row.created_at,
        emittedMs: atMs,
      });
      pendingByProduct.set(productId, queue);
      continue;
    }

    const browseEvent = isBrowseEvent(row);
    if (browseEvent?.action !== "add_to_cart" || !browseEvent.productId) continue;

    const queue = pendingByProduct.get(browseEvent.productId);
    if (!queue || queue.length === 0) continue;

    const matchIndex = queue.findIndex(
      (emit) =>
        atMs >= emit.emittedMs &&
        (atMs - emit.emittedMs) / 1000 <= windowSec
    );
    if (matchIndex < 0) continue;

    const emit = queue.splice(matchIndex, 1)[0]!;
    if (queue.length === 0) pendingByProduct.delete(browseEvent.productId);

    const lagSeconds = Math.max(0, Math.round((atMs - emit.emittedMs) / 1000));
    conversions.push({
      productId: emit.productId,
      productName:
        emit.productName ?? browseEvent.productName?.trim() ?? null,
      nudgeKind: emit.nudgeKind,
      offerResolution: emit.offerResolution,
      emittedAt: emit.emittedAt,
      convertedAt: browseEvent.timestamp || row.created_at,
      lagSeconds,
    });
  }

  return conversions;
}
