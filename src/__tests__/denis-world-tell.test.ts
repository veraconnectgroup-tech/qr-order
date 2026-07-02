import { describe, expect, it } from "vitest";
import { buildViewHeadline } from "@/lib/denis/loop/project-view-layers";
import { resolveLocaleFromLanguage } from "@/lib/denis/loop/resolve-ai-session-locale";
import { resolveWorldOrderTell } from "@/lib/denis/loop/tell-world-order";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

describe("resolveWorldOrderTell (Phase D)", () => {
  it("uses one template string for ready status", () => {
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "ready",
      previousStatus: "preparing",
      orderNumber: 42,
      menuLocale: "de",
    });

    expect(tell).not.toBeNull();
    expect(tell!.message).toContain("42");
    expect(tell!.push).toBe(true);
    expect(tell!.markState).toBe("listen");
  });

  it("headline equals tell message (push = dock = transcript source)", () => {
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "ready",
      previousStatus: "preparing",
      orderNumber: 7,
      menuLocale: "de",
    })!;

    const headline = buildViewHeadline(null, "waiting", tell.message);
    expect(headline).toBe(tell.message);

    const timeline: DenisTimelineRow[] = [
      {
        id: "n1",
        ai_session_id: "ai-1",
        seq: 1,
        event_type: "narration.sent",
        payload: {
          type: "narration.sent",
          message: tell.message,
          tier: "template",
        },
        trace_id: "t1",
        context_hash: null,
        created_at: "2026-05-28T12:00:00.000Z",
      },
    ];

    const transcript = foldTranscriptFromTimeline(timeline);
    expect(transcript[0]?.text).toBe(tell.message);
    expect(transcript[0]?.text).toBe(headline);
  });

  it("skips non-notifiable status transitions", () => {
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "preparing",
      previousStatus: "ready",
      orderNumber: 1,
      menuLocale: "de",
    });
    expect(tell).toBeNull();
  });

  it("uses guest session language instead of venue default", () => {
    const sr = resolveLocaleFromLanguage("sr", "de");
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "ready",
      previousStatus: "preparing",
      orderNumber: 3,
      menuLocale: sr.menuLocale,
      isEnglish: sr.isEnglish,
    })!;

    expect(tell.message).toContain("3");
    expect(tell.message.toLowerCase()).not.toContain("bereit");
  });

  it("order ready → tell message appears in transcript and headline", () => {
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "ready",
      previousStatus: "preparing",
      orderNumber: 99,
      menuLocale: "de",
    })!;

    const headline = buildViewHeadline(null, "waiting", tell.message);
    const timeline: DenisTimelineRow[] = [
      {
        id: "w1",
        ai_session_id: "ai-1",
        seq: 1,
        event_type: "world.ingested",
        payload: {
          type: "world.ingested",
          signal: "commerce.order_status",
          orderId: "ord-1",
          orderNumber: 99,
          status: "ready",
        },
        trace_id: "trace-1",
        context_hash: null,
        created_at: "2026-06-06T12:00:00.000Z",
      },
      {
        id: "w2",
        ai_session_id: "ai-1",
        seq: 2,
        event_type: "tell.committed",
        payload: {
          type: "tell.committed",
          message: tell.message,
          tier: "template",
          source: "world.commerce",
        },
        trace_id: "trace-1",
        context_hash: null,
        created_at: "2026-06-06T12:00:01.000Z",
      },
      {
        id: "w3",
        ai_session_id: "ai-1",
        seq: 3,
        event_type: "narration.sent",
        payload: {
          type: "narration.sent",
          message: tell.message,
          tier: "template",
          source: "world.commerce",
        },
        trace_id: "trace-1",
        context_hash: null,
        created_at: "2026-06-06T12:00:02.000Z",
      },
    ];

    const transcript = foldTranscriptFromTimeline(timeline);
    const denisLines = transcript.filter((entry) => entry.role === "denis");
    expect(denisLines.length).toBeGreaterThanOrEqual(1);
    expect(denisLines.every((entry) => entry.text === tell.message)).toBe(true);
    expect(headline).toBe(tell.message);
    expect(tell.push).toBe(true);
  });

  it("bar station ready tell fires while global status is still preparing", () => {
    const tell = resolveWorldOrderTell({
      signal: "commerce.order_status",
      status: "preparing",
      previousStatus: "preparing",
      orderNumber: 5,
      menuLocale: "sr",
      stationTell: { station: "bar" },
    });

    expect(tell).not.toBeNull();
    expect(tell!.message.toLowerCase()).toContain("piće");
    expect(tell!.push).toBe(true);
    expect(tell!.persistTell).toBe(true);
  });
});
