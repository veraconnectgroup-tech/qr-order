import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { TurnEnvelope } from "@/lib/denis/platform/timeline-types";

/**
 * Record browse telemetry in timeline — no DECIDE/ACT/TELL cycle.
 */
export async function ingestBrowseTelemetry(
  admin: SupabaseClient,
  aiSessionId: string,
  event: BrowseEvent,
  traceId: string,
  envelope: TurnEnvelope
): Promise<void> {
  const normalizedText =
    event.productName?.trim() ||
    event.categoryPath?.join("/") ||
    event.action;

  await appendDenisTimelineEvent(admin, {
    aiSessionId,
    eventType: "perception.ingested",
    traceId,
    payload: {
      type: "perception.ingested",
      envelope,
      frame: {
        channel: "telemetry.browse",
        normalizedText,
        structuredIntent: "BROWSE",
        ingestedAt: event.timestamp,
      },
      browseEvent: event,
    },
  });
}
