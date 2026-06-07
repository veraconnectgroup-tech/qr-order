import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import type { BrowseSequenceEntry } from "@/lib/denis/cognition/offer/offer-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

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

/** Chronological browse sequence from timeline (GMM-9). */
export function foldBrowseSequence(timeline: DenisTimelineRow[]): BrowseSequenceEntry[] {
  const sequence: BrowseSequenceEntry[] = [];

  for (const row of timeline) {
    const event = isBrowseEvent(row);
    if (!event) continue;

    sequence.push({
      at: event.timestamp || row.created_at,
      action: event.action,
      productId: event.productId,
      categoryId: event.categoryId,
      menuSection: event.menuSection ?? null,
      dwellMs: event.dwellMs,
    });
  }

  return sequence;
}
