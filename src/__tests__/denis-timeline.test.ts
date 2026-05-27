import { describe, expect, it } from "vitest";
import {
  emptyMinimalBeliefs,
  foldMinimalBeliefs,
} from "@/lib/denis/kernel/fold-beliefs";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  isRiskClassAllowedInRollout,
} from "@/lib/denis/platform/risk-levels";

function row(
  seq: number,
  event_type: DenisTimelineRow["event_type"],
  payload: DenisTimelineRow["payload"],
  created_at = "2026-05-27T12:00:00.000Z"
): DenisTimelineRow {
  return {
    id: `id-${seq}`,
    ai_session_id: "session-1",
    seq,
    event_type,
    payload,
    trace_id: seq === 1 ? "trace-abc" : null,
    context_hash: null,
    created_at,
  };
}

describe("foldMinimalBeliefs M2", () => {
  it("starts empty", () => {
    expect(emptyMinimalBeliefs().meta.eventCount).toBe(0);
  });

  it("folds perception, intent, and order ack", () => {
    const beliefs = foldMinimalBeliefs([
      row(1, "perception.ingested", {
        type: "perception.ingested",
        frame: {
          channel: "chat.message",
          normalizedText: "cola molim",
          structuredIntent: "ORDER",
          ingestedAt: "2026-05-27T12:00:00.000Z",
        },
        envelope: { traceId: "trace-abc", surface: "chat", configVersion: 1 },
      }),
      row(2, "intent.resolved", {
        type: "intent.resolved",
        intent: "ORDER",
        tier: "T0",
      }),
      row(3, "order.command.ack", {
        type: "order.command.ack",
        orderId: "order-1",
      }),
    ]);

    expect(beliefs.meta.eventCount).toBe(3);
    expect(beliefs.meta.lastTraceId).toBe("trace-abc");
    expect(beliefs.attention.lastMessage?.value).toBe("cola molim");
    expect(beliefs.guest.lastUserIntent?.value).toBe("ORDER");
    expect(beliefs.table.hasOpenOrders?.value).toBe(true);
    expect(beliefs.table.sessionActive?.value).toBe(true);
  });
});

describe("risk levels ADR-006", () => {
  it("blocks R5 in staff_only rollout", () => {
    expect(isRiskClassAllowedInRollout("staff_only", "R0")).toBe(true);
    expect(isRiskClassAllowedInRollout("staff_only", "R3")).toBe(true);
    expect(isRiskClassAllowedInRollout("staff_only", "R5")).toBe(false);
  });
});
