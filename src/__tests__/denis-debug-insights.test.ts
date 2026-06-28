import { describe, expect, it } from "vitest";
import {
  buildDenisSessionReplay,
  buildReplayTimeline,
  computeSessionConversationQuality,
} from "@/lib/admin/denis-session-replay";
import {
  aggregateGuestIntents,
  buildDenisInsightsAggregate,
  collectUnknownIntentEdgeCases,
  detectDenisInsightProblems,
} from "@/lib/admin/denis-insights-aggregate";
import {
  edgeCaseToLearning,
  unknownIntentToEvalScenario,
} from "@/lib/admin/denis-edge-cases";
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
    created_at: `2026-06-01T12:00:${String(seq).padStart(2, "0")}.000Z`,
  };
}

describe("buildReplayTimeline", () => {
  it("shows all timeline events with categories", () => {
    const events = [
      row(1, "perception.ingested", { frame: { normalizedText: "hello" } }),
      row(2, "plan.created", { topGoal: "COMPLETE_ROUND" }),
      row(3, "narration.sent", { message: "Hi!" }),
    ];

    const timeline = buildReplayTimeline(events);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]?.category).toBe("signal");
    expect(timeline[1]?.category).toBe("act");
    expect(timeline[2]?.category).toBe("act");
  });
});

describe("buildDenisSessionReplay", () => {
  it("builds turn explanations and proactive decisions", () => {
    const events = [
      row(1, "perception.ingested", {
        frame: { normalizedText: "mogu li platiti" },
      }),
      row(2, "intent.resolved", { intent: "UNKNOWN", tier: "T2" }),
      row(3, "narration.sent", { message: "Ne razumem.", tier: "T3" }),
      row(4, "mental_model.gate", {
        candidateKind: "dessert_upsell",
        allow: false,
        reason: "receptiveness closed",
      }),
      row(5, "proactive.emitted", {
        kind: "browse_nudge",
        message: "Probajte desert?",
      }),
    ];

    const replay = buildDenisSessionReplay({ events, traces: [] });

    expect(replay.timeline).toHaveLength(5);
    expect(replay.turnExplanations[0]?.guestText).toBe("mogu li platiti");
    expect(replay.turnExplanations[0]?.intent).toBe("UNKNOWN");
    expect(replay.proactiveDecisions.some((r) => r.emitted)).toBe(true);
    expect(replay.proactiveDecisions.some((r) => !r.allow)).toBe(true);
  });
});

describe("collectUnknownIntentEdgeCases", () => {
  it("logs unknown intents for admin review", () => {
    const events = [
      row(1, "perception.ingested", {
        frame: { normalizedText: "mogu li platiti" },
      }),
      row(2, "intent.resolved", { intent: "UNKNOWN" }),
      row(3, "narration.sent", { message: "Molim sačekajte konobara." }),
    ];

    const cases = collectUnknownIntentEdgeCases({
      sessionId: "session-1",
      events,
    });

    expect(cases).toHaveLength(1);
    expect(cases[0]?.guestText).toBe("mogu li platiti");
    expect(cases[0]?.denisResponse).toContain("konobara");
  });
});

describe("aggregateGuestIntents", () => {
  it("computes intent percentages", () => {
    const events = [
      row(1, "intent.resolved", { intent: "ORDER" }),
      row(2, "intent.resolved", { intent: "ORDER" }),
      row(3, "intent.resolved", { intent: "BROWSE" }),
      row(4, "intent.resolved", { intent: "HANDOFF_PAY" }),
    ];

    const breakdown = aggregateGuestIntents(events);
    const ordering = breakdown.find((row) => row.intent === "ORDER");

    expect(ordering?.percent).toBe(50);
    expect(breakdown.reduce((sum, slice) => sum + slice.percent, 0)).toBe(100);
  });
});

describe("detectDenisInsightProblems", () => {
  it("flags payment phrase misunderstandings", () => {
    const events = [
      row(1, "perception.ingested", {
        frame: { normalizedText: "mogu li platiti" },
      }),
      row(2, "intent.resolved", { intent: "UNKNOWN" }),
    ];

    const problems = detectDenisInsightProblems({
      events,
      sessionCount: 1,
    });

    expect(problems.some((p) => p.id === "pay_handoff_miss")).toBe(true);
  });
});

describe("buildDenisInsightsAggregate", () => {
  it("combines intents, quality trend, and edge cases", () => {
    const quality = computeSessionConversationQuality({ events: [], traces: [] });
    const aggregate = buildDenisInsightsAggregate({
      events: [row(1, "intent.resolved", { intent: "ORDER" })],
      sessionCount: 1,
      sessionQualities: [{ createdAt: new Date().toISOString(), quality }],
      edgeCases: [],
    });

    expect(aggregate.intentBreakdown).toHaveLength(1);
    expect(aggregate.suggestions.length).toBeGreaterThan(0);
    expect(aggregate.avgQualityScore).toBeGreaterThan(0);
  });
});

describe("edge case eval promotion", () => {
  it("maps unknown intent to eval scenario shape", () => {
    const scenario = unknownIntentToEvalScenario({
      id: "case-1",
      sessionId: "session-1",
      guestText: "mogu li platiti",
      denisResponse: "Ne razumem.",
      capturedAt: new Date().toISOString(),
      reviewed: false,
    });

    expect(scenario.message).toBe("mogu li platiti");
    expect(scenario.id).toContain("admin_review");

    const learning = edgeCaseToLearning({
      id: "case-1",
      sessionId: "session-1",
      guestText: "mogu li platiti",
      denisResponse: "Ne razumem.",
      capturedAt: new Date().toISOString(),
      reviewed: true,
    });

    expect(learning.kind).toBe("mismatch");
  });
});
