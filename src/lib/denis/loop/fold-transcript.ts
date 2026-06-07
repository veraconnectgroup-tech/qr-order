import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

type StoredChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function guestTextFromEvent(
  eventType: string,
  payload: Record<string, unknown>
): string | null {
  if (eventType === "signal.message") {
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    return text || null;
  }

  if (eventType === "perception.ingested") {
    const frame = payload.frame;
    if (!frame || typeof frame !== "object") return null;
    const text =
      typeof (frame as Record<string, unknown>).normalizedText === "string"
        ? ((frame as Record<string, unknown>).normalizedText as string).trim()
        : "";
    return text || null;
  }

  return null;
}

function denisTextFromEvent(
  eventType: string,
  payload: Record<string, unknown>
): string | null {
  if (eventType === "tell.committed") {
    if (payload.source === "sense.proactive") {
      return null;
    }
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    return message || null;
  }

  if (eventType === "narration.sent") {
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    return message || null;
  }

  return null;
}

function pushTranscriptEntry(
  entries: TranscriptEntry[],
  entry: TranscriptEntry
): void {
  const last = entries[entries.length - 1];
  if (last && last.role === entry.role && last.text === entry.text) {
    return;
  }
  entries.push(entry);
}

/** Fold guest/denis lines from append-only timeline (ADR-019 Phase F — single TRUTH stream). */
export function foldTranscriptFromTimeline(
  events: DenisTimelineRow[]
): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];

  for (const event of events) {
    const payload = asRecord(event.payload);

    const guestText = guestTextFromEvent(event.event_type, payload);
    if (guestText) {
      pushTranscriptEntry(entries, {
        id: event.id,
        role: "guest",
        text: guestText,
        at: event.created_at,
      });
      continue;
    }

    const denisText = denisTextFromEvent(event.event_type, payload);
    if (denisText) {
      pushTranscriptEntry(entries, {
        id: event.id,
        role: "denis",
        text: denisText,
        at: event.created_at,
      });
    }
  }

  return entries;
}

/** Last committed TELL line — for FOLD conversation projection. */
export function lastTellFromTimeline(
  events: DenisTimelineRow[]
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const text = denisTextFromEvent(
      event.event_type,
      asRecord(event.payload)
    );
    if (text) return text;
  }
  return null;
}

/** Replay chat history for LLM context — timeline is source of truth (Phase F). */
export function timelineToStoredMessages(
  events: DenisTimelineRow[]
): StoredChatMessage[] {
  return foldTranscriptFromTimeline(events).map((entry) => ({
    role: entry.role === "guest" ? "user" : "assistant",
    content: entry.text,
    timestamp: entry.at,
  }));
}
