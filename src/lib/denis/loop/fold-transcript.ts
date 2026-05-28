import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Fold guest/denis lines from append-only timeline (Phase B — partial TRUTH stream). */
export function foldTranscriptFromTimeline(
  events: DenisTimelineRow[]
): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];

  for (const event of events) {
    const payload = asRecord(event.payload);

    if (event.event_type === "perception.ingested") {
      const frame = payload.frame;
      if (!frame || typeof frame !== "object") continue;
      const text =
        typeof (frame as Record<string, unknown>).normalizedText === "string"
          ? ((frame as Record<string, unknown>).normalizedText as string).trim()
          : "";
      if (!text) continue;
      entries.push({
        id: event.id,
        role: "guest",
        text,
        at: event.created_at,
      });
      continue;
    }

    if (event.event_type === "narration.sent") {
      const message =
        typeof payload.message === "string" ? payload.message.trim() : "";
      if (!message) continue;
      entries.push({
        id: event.id,
        role: "denis",
        text: message,
        at: event.created_at,
      });
    }
  }

  return entries;
}
