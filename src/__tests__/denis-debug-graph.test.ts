import { describe, expect, it } from "vitest";
import { buildSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function row(
  seq: number,
  event_type: DenisTimelineRow["event_type"],
  payload: DenisTimelineRow["payload"],
  trace_id: string | null = "trace-1"
): DenisTimelineRow {
  return {
    id: `id-${seq}`,
    ai_session_id: "session-1",
    seq,
    event_type,
    payload,
    trace_id,
    context_hash: null,
    created_at: "2026-05-27T12:00:00.000Z",
  };
}

describe("Denis M19 session debug graph", () => {
  it("folds beliefs, flow, goals, and turn summaries", () => {
    const graph = buildSessionDebugGraph([
      row(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "zwei cola",
          structuredIntent: null,
          ingestedAt: "2026-05-27T12:00:00.000Z",
        },
      }),
      row(2, "intent.resolved", {
        type: "intent.resolved",
        intent: "ORDER",
        tier: "T0",
      }),
      row(3, "flow.transitioned", {
        from: "welcome",
        to: "collect",
        signal: "guest_message",
        goals: ["COMPLETE_ROUND"],
        skills: [{ id: "parse_order", riskClass: "R2" }],
      }),
      row(4, "plan.created", {
        type: "plan.created",
        actions: [{ skillId: "parse_order", riskClass: "R2" }],
        topGoal: "COMPLETE_ROUND",
      }),
      row(5, "narration.sent", {
        type: "narration.sent",
        message: "Zwei Cola — passt?",
        tier: "template",
      }),
    ]);

    expect(graph.meta.eventCount).toBe(5);
    expect(graph.beliefs.some((b) => b.key === "guest.lastUserIntent")).toBe(
      true
    );
    expect(graph.flow.currentNodeId).toBe("collect");
    expect(graph.topGoal).toBe("COMPLETE_ROUND");
    expect(graph.turns).toHaveLength(1);
    expect(graph.turns[0]?.guestText).toBe("zwei cola");
    expect(graph.turns[0]?.topGoal).toBe("COMPLETE_ROUND");
    expect(graph.timeline).toHaveLength(5);
  });

  it("flags cart conflict from belief.revision", () => {
    const graph = buildSessionDebugGraph([
      row(1, "belief.revision", {
        type: "belief.revision",
        keys: ["cart.conflict"],
      }),
    ]);

    expect(graph.meta.hasCartConflict).toBe(true);
    expect(graph.goals.some((g) => g.type === "RECONCILE_CART")).toBe(true);
  });
});
