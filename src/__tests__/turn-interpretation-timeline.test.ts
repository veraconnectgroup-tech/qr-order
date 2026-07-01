import { describe, expect, it } from "vitest";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import {
  collectTurnInterpretationsFromTimeline,
  extractTurnInterpretation,
  extractTurnInterpretationFromTimeline,
  normalizeTurnInterpretation,
} from "@/lib/denis/cognition/tde/extract-turn-interpretation";

function perceptionRow(
  seq: number,
  text: string,
  interpretation: Record<string, unknown>
): DenisTimelineRow {
  const normalized = normalizeTurnInterpretation(interpretation);
  return {
    id: `p-${seq}`,
    ai_session_id: "sess-1",
    seq,
    event_type: "perception.ingested",
    payload: {
      type: "perception.ingested",
      envelope: { traceId: `t${seq}`, surface: "chat" },
      frame: {
        channel: "chat.message",
        normalizedText: text,
        structuredIntent: null,
        ingestedAt: new Date().toISOString(),
        interpretation: normalized,
      },
      interpretation: normalized,
      turnInterpretation: normalized,
    },
    trace_id: null,
    context_hash: null,
    created_at: new Date(Date.now() + seq * 1000).toISOString(),
  };
}

describe("turn interpretation timeline wiring", () => {
  it("extractTurnInterpretation prefers LLM turnInterpretation block", () => {
    const result = extractTurnInterpretation({
      llmUsed: true,
      guestMessage: "daj mi pivo",
      structured: {
        intent: "order",
        message: "Naravno!",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
        turnInterpretation: {
          sentiment: "positive",
          mealStage: "ordering",
          modifications: [],
          preferences: [],
          followUpMinutes: null,
          partySize: null,
          awaiting: null,
          askedDessert: false,
          sidePreference: null,
          cookingPreference: null,
          agreedOrderLine: null,
          guestReferenceKind: null,
          guestReferenceDetail: null,
        },
      },
    });

    expect(result.sentiment).toBe("positive");
    expect(result.mealStage).toBe("ordering");
  });

  it("extractTurnInterpretation synthesizes router fallback without LLM block", () => {
    const result = extractTurnInterpretation({
      llmUsed: false,
      guestMessage: "nisi poslao",
      structured: {
        intent: "chat",
        message: "Izvinite",
        recommendations: [],
        proposedItems: [],
        quickReplies: [],
        submitOrder: false,
      },
    });

    expect(result.sentiment).toBe("frustrated");
    expect(result.mealStage).toBe("waiting");
  });

  it("reads interpretation from perception.ingested timeline payload", () => {
    const timeline = [
      perceptionRow(1, "Zdravo", { sentiment: "positive", mealStage: null }),
      perceptionRow(2, "gde je hrana", {
        sentiment: "frustrated",
        mealStage: "waiting",
      }),
    ];

    const latest = extractTurnInterpretationFromTimeline(timeline);
    expect(latest?.sentiment).toBe("frustrated");
    expect(latest?.mealStage).toBe("waiting");

    const all = collectTurnInterpretationsFromTimeline(timeline);
    expect(all).toHaveLength(2);
    expect(all[0]?.guestText).toBe("Zdravo");
    expect(all[1]?.interpretation.sentiment).toBe("frustrated");
  });
});
