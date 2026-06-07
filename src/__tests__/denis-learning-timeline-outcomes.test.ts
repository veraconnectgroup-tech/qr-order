import { describe, expect, it } from "vitest";
import { readAcceptedNudgeOutcomes } from "@/lib/denis/learning/timeline-nudge-outcomes";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

describe("readAcceptedNudgeOutcomes", () => {
  it("reads accepted outcomes from anticipation.resolved only", () => {
    const timeline: DenisTimelineRow[] = [
      {
        id: "1",
        ai_session_id: "s1",
        seq: 1,
        event_type: "anticipation.resolved",
        trace_id: "t1",
        context_hash: null,
        created_at: "2026-06-07T20:00:00.000Z",
        payload: {
          type: "anticipation.resolved",
          outcome: "accepted",
          productId: "p1",
          productName: "Burger",
          nudgeKind: "browse_nudge",
        },
      },
      {
        id: "2",
        ai_session_id: "s1",
        seq: 2,
        event_type: "anticipation.resolved",
        trace_id: "t2",
        context_hash: null,
        created_at: "2026-06-07T20:01:00.000Z",
        payload: {
          type: "anticipation.resolved",
          outcome: "declined",
          productId: "p2",
          nudgeKind: "dessert_nudge",
        },
      },
    ];

    const accepts = readAcceptedNudgeOutcomes(timeline);
    expect(accepts).toHaveLength(1);
    expect(accepts[0]?.productId).toBe("p1");
    expect(accepts[0]?.nudgeKind).toBe("browse_nudge");
  });
});
