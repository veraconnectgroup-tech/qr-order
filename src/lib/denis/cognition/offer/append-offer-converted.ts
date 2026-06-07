import {
  buildOfferConvertedPayload,
  findNewOfferConversions,
} from "@/lib/denis/cognition/offer/offer-conversion-timeline";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Append offer.converted for newly detected nudge→cart matches (GMM-12). */
export async function maybeAppendOfferConverted(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    timeline: DenisTimelineRow[];
    contextHash?: string | null;
  }
): Promise<number> {
  const fresh = findNewOfferConversions(input.timeline);
  if (fresh.length === 0) return 0;

  for (const conversion of fresh) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "offer.converted",
      traceId: input.traceId,
      contextHash: input.contextHash ?? null,
      payload: buildOfferConvertedPayload(conversion),
    });
  }

  return fresh.length;
}
