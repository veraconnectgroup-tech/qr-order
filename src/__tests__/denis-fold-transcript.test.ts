import { describe, expect, it } from "vitest";
import {
  foldTranscriptFromTimeline,
  lastTellFromTimeline,
  timelineToStoredMessages,
} from "@/lib/denis/loop/fold-transcript";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function row(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>
): DenisTimelineRow {
  return {
    id: `evt-${seq}`,
    ai_session_id: "ai-1",
    seq,
    event_type: eventType,
    payload,
    trace_id: `trace-${seq}`,
    context_hash: null,
    created_at: `2026-05-28T12:00:0${seq}.000Z`,
  };
}

describe("foldTranscriptFromTimeline Phase F", () => {
  it("prefers signal.message and tell.committed as canonical TRUTH stream", () => {
    const transcript = foldTranscriptFromTimeline([
      row(1, "signal.message", {
        type: "signal.message",
        text: "Status porudžbine?",
        channel: "chat.message",
      }),
      row(2, "tell.committed", {
        type: "tell.committed",
        message: "Porudžbina #42 je u pripremi.",
        tier: "template",
      }),
    ]);

    expect(transcript).toHaveLength(2);
    expect(transcript[0]?.role).toBe("guest");
    expect(transcript[1]?.role).toBe("denis");
    expect(transcript[1]?.text).toContain("#42");
  });

  it("falls back to legacy perception.ingested and narration.sent", () => {
    const transcript = foldTranscriptFromTimeline([
      row(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "Hallo",
          structuredIntent: "SMALLTALK",
          ingestedAt: "2026-05-28T12:00:01.000Z",
        },
      }),
      row(2, "narration.sent", {
        type: "narration.sent",
        message: "Willkommen!",
        tier: "template",
      }),
    ]);

    expect(transcript).toHaveLength(2);
    expect(transcript[0]?.text).toBe("Hallo");
    expect(transcript[1]?.text).toBe("Willkommen!");
  });

  it("dedupes when both canonical and legacy events exist for one turn", () => {
    const transcript = foldTranscriptFromTimeline([
      row(1, "signal.message", {
        type: "signal.message",
        text: "Hi",
      }),
      row(2, "perception.ingested", {
        type: "perception.ingested",
        frame: { normalizedText: "Hi", channel: "chat.message" },
      }),
      row(3, "tell.committed", {
        type: "tell.committed",
        message: "Hey there",
      }),
      row(4, "narration.sent", {
        type: "narration.sent",
        message: "Hey there",
      }),
    ]);

    expect(transcript).toHaveLength(2);
    expect(transcript[0]?.text).toBe("Hi");
    expect(transcript[1]?.text).toBe("Hey there");
  });

  it("includes proactive dock welcome in guest-visible transcript", () => {
    const transcript = foldTranscriptFromTimeline([
      row(1, "tell.committed", {
        type: "tell.committed",
        message: "Dobrodošli u Skyline Lounge!",
        source: "sense.proactive_dock",
      }),
      row(2, "narration.sent", {
        type: "narration.sent",
        message: "Dobrodošli u Skyline Lounge!",
        source: "sense.proactive_dock",
      }),
      row(3, "signal.message", { type: "signal.message", text: "još gledamo" }),
    ]);

    expect(transcript).toHaveLength(2);
    expect(transcript[0]?.role).toBe("denis");
    expect(transcript[1]?.role).toBe("guest");
  });

  it("excludes proactive banner tells from guest chat transcript", () => {
    const transcript = foldTranscriptFromTimeline([
      row(1, "tell.committed", {
        type: "tell.committed",
        message: "Can I help you choose?",
        source: "sense.proactive",
      }),
      row(2, "tell.committed", {
        type: "tell.committed",
        message: "Porudžbina primljena.",
      }),
    ]);

    expect(transcript).toHaveLength(1);
    expect(transcript[0]?.text).toContain("Porudžbina");
  });

  it("derives last tell and stored chat history from timeline", () => {
    const timeline = [
      row(1, "signal.message", { type: "signal.message", text: "A" }),
      row(2, "tell.committed", { type: "tell.committed", message: "B" }),
      row(3, "signal.message", { type: "signal.message", text: "C" }),
      row(4, "tell.committed", { type: "tell.committed", message: "D" }),
    ];

    expect(lastTellFromTimeline(timeline)).toBe("D");
    expect(timelineToStoredMessages(timeline)).toEqual([
      { role: "user", content: "A", timestamp: timeline[0]!.created_at },
      { role: "assistant", content: "B", timestamp: timeline[1]!.created_at },
      { role: "user", content: "C", timestamp: timeline[2]!.created_at },
      { role: "assistant", content: "D", timestamp: timeline[3]!.created_at },
    ]);
  });
});
