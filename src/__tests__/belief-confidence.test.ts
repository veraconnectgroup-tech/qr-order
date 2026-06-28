import { describe, expect, it } from "vitest";
import {
  applyBeliefConfidencePipeline,
  computeDecayedConfidence,
  resolveBeliefConflicts,
  belief,
  beliefGraph,
  CORE_BELIEF_KEYS,
} from "@/lib/denis/cognition/beliefs";
import { DEFAULT_BELIEF_DECAY_CONFIG } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  foldMinimalBeliefs,
  beliefConfidenceColor,
} from "@/lib/denis/kernel/fold-beliefs";

describe("belief confidence propagation (Prompt 91)", () => {
  const baseNow = Date.parse("2026-06-28T12:00:00.000Z");

  it("allergy beliefs never decay", () => {
    const decayed = computeDecayedConfidence(
      1,
      baseNow - 20 * 60 * 1000,
      baseNow,
      "allergies",
      DEFAULT_BELIEF_DECAY_CONFIG
    );
    expect(decayed).toBe(1);
  });

  it("intent beliefs decay after 5 minutes", () => {
    const decayed = computeDecayedConfidence(
      0.9,
      baseNow - 6 * 60 * 1000,
      baseNow,
      "intent",
      DEFAULT_BELIEF_DECAY_CONFIG
    );
    expect(decayed).toBeLessThanOrEqual(0.55);
  });

  it("conflict resolution prefers latest explicit", () => {
    const resolved = resolveBeliefConflicts(
      [
        belief("guest.lastUserIntent", "BROWSE", "inferred", 0.5, {
          observedAtMs: baseNow - 6 * 60 * 1000,
        }),
        belief("guest.lastUserIntent", "ORDER", "explicit", 1, {
          observedAtMs: baseNow,
        }),
      ],
      [],
      baseNow
    );
    expect(resolved[0]?.value).toBe("ORDER");
  });

  it("propagates gluten allergy to menu filter in compile pipeline", () => {
    const graph = applyBeliefConfidencePipeline({
      graph: beliefGraph([
        belief(CORE_BELIEF_KEYS.guestAllergies, ["gluten"], "memory", 1),
      ]),
      nowMs: baseNow,
    });
    const filter = graph.beliefs.find(
      (row) => row.key === CORE_BELIEF_KEYS.menuFilter
    );
    expect(filter?.value).toBe("no_gluten");
    expect(filter?.propagatedFrom).toBe(CORE_BELIEF_KEYS.guestAllergies);
  });

  it("foldMinimalBeliefs reinforces repeated allergy mentions", () => {
    const folded = foldMinimalBeliefs(
      [
        {
          id: "1",
          ai_session_id: "s",
          seq: 1,
          event_type: "perception.ingested",
          payload: {
            type: "perception.ingested",
            frame: {
              channel: "chat.message",
              normalizedText: "bez glutena",
              structuredIntent: null,
              ingestedAt: "2026-06-28T11:55:00.000Z",
            },
          },
          trace_id: "t1",
          context_hash: null,
          created_at: "2026-06-28T11:55:00.000Z",
        },
        {
          id: "2",
          ai_session_id: "s",
          seq: 2,
          event_type: "perception.ingested",
          payload: {
            type: "perception.ingested",
            frame: {
              channel: "chat.message",
              normalizedText: "bez glutena",
              structuredIntent: null,
              ingestedAt: "2026-06-28T11:56:00.000Z",
            },
          },
          trace_id: "t2",
          context_hash: null,
          created_at: "2026-06-28T11:56:00.000Z",
        },
      ],
      { nowMs: baseNow }
    );
    expect(folded.guest.allergies?.confidence).toBe(1);
    expect(
      folded.propagated.some(
        (row) => row.key === "menu.filter" && row.value === "no_gluten"
      )
    ).toBe(true);
  });

  it("beliefConfidenceColor maps high confidence to green-ish", () => {
    expect(beliefConfidenceColor(1)).toMatch(/rgb\(\d+, \d+, 80\)/);
    expect(beliefConfidenceColor(0.5)).toMatch(/rgb\(\d+, \d+, 80\)/);
  });
});
