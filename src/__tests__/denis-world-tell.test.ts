import { describe, expect, it } from "vitest";
import { buildViewHeadline } from "@/lib/denis/loop/project-view-layers";
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
});
