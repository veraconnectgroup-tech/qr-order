import {
  buildOfferResolvedPayload,
  extractLastOfferSnapshot,
  shouldAppendOfferResolved,
} from "@/lib/denis/cognition/offer/offer-timeline";
import type { GuestOfferContext } from "@/lib/denis/cognition/offer/offer-types";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Append offer.resolved when hash changed (ADR-038 GMM-9 observability). */
export async function maybeAppendOfferResolved(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    timeline: DenisTimelineRow[];
    offer: GuestOfferContext;
    contextHash?: string | null;
  }
): Promise<boolean> {
  if (!shouldAppendOfferResolved(input)) return false;

  const previous = extractLastOfferSnapshot(input.timeline);
  const payload = buildOfferResolvedPayload({
    offer: input.offer,
    previous,
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "offer.resolved",
    traceId: input.traceId,
    contextHash: input.contextHash ?? input.offer.hash,
    payload,
  });

  return true;
}
