import { describe, expect, it } from "vitest";
import {
  runContinuousEvalLoop,
  scoreSessionQuality,
  SESSION_QUALITY_ANOMALY_THRESHOLD,
} from "@/lib/denis/eval/continuous-eval-loop";
import {
  extractSessionLearnings,
  type ExtractedLearning,
} from "@/lib/denis/eval/learning-extractor";
import {
  canAutoDeployPromptEvolution,
  evaluatePromptAbTest,
  generateEvolvedPromptSection,
  PROMPT_LEARNING_THRESHOLD,
  selectPromptWinner,
} from "@/lib/denis/eval/prompt-evolver";
import { mergeProductionEdgeCases } from "@/lib/denis/eval/fixtures/production-edge-cases";
import { runDenisScenario } from "@/lib/denis/eval/run-scenario";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

function badSessionMessages() {
  return [
    { role: "guest" as const, text: "Imate li mojito?", at: "2026-06-01T12:00:00.000Z" },
    {
      role: "denis" as const,
      text: "Preporučujem našu laganu salatu i pilsner.",
      at: "2026-06-01T12:00:05.000Z",
    },
    {
      role: "guest" as const,
      text: "Ne, tražio sam mojito — imate li?",
      at: "2026-06-01T12:00:20.000Z",
    },
    {
      role: "guest" as const,
      text: "Može mi konobar molim vas?",
      at: "2026-06-01T12:00:35.000Z",
    },
  ];
}

function buildSyntheticLearnings(count: number): ExtractedLearning[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `synthetic:${index}`,
    kind: index % 4 === 0 ? "correction" : index % 3 === 0 ? "waiter_failure" : "mismatch",
    guestMessage: `Guest request ${index}: Imate li stavku ${index}?`,
    denisResponse: `Denis reply ${index}`,
    correctedTo: index % 4 === 0 ? `Stavka ${index}` : undefined,
    sessionId: `session-${Math.floor(index / 5)}`,
    capturedAt: new Date(Date.UTC(2026, 5, 1, 12, index)).toISOString(),
    confidence: 0.85,
  })) as ExtractedLearning[];
}

describe("learning-extractor", () => {
  it("extracts correction + waiter_failure from a bad session", () => {
    const learnings = extractSessionLearnings({
      sessionId: "sess-bad",
      messages: badSessionMessages(),
    });

    expect(learnings.some((row) => row.kind === "correction")).toBe(true);
    expect(learnings.some((row) => row.kind === "waiter_failure")).toBe(true);
    expect(learnings.some((row) => row.kind === "mismatch")).toBe(true);
  });
});

describe("continuous-eval-loop", () => {
  it("flags anomaly when session quality is below threshold", async () => {
    const learnings = extractSessionLearnings({
      sessionId: "sess-bad",
      messages: badSessionMessages(),
    });

    const scores = scoreSessionQuality(learnings, {
      turnCount: 3,
      upsellOffered: true,
      upsellAccepted: false,
      handoffAfterDenis: true,
      ordersCount: 0,
    });

    expect(scores.overall).toBeLessThan(0.8);
    expect(learnings.filter((row) => row.kind !== "reinforcement").length).toBeGreaterThanOrEqual(2);

    const result = await runContinuousEvalLoop({
      sessionId: "sess-bad",
      locationId: "loc-1",
      timeline: [],
      messages: badSessionMessages(),
      metrics: {
        turnCount: 3,
        upsellOffered: true,
        upsellAccepted: false,
        handoffAfterDenis: true,
        ordersCount: 0,
      },
    });

    expect(result.anomaly).toBe(scores.overall < SESSION_QUALITY_ANOMALY_THRESHOLD);
    expect(result.learnings.length).toBeGreaterThan(0);
  });
});

describe("prompt-evolver", () => {
  it("does not evolve prompt before 50 learnings", () => {
    const section = generateEvolvedPromptSection(
      buildSyntheticLearnings(PROMPT_LEARNING_THRESHOLD - 1)
    );
    expect(section).toBeNull();
  });

  it("generates evolved prompt section after 50 learnings", () => {
    const learnings = buildSyntheticLearnings(PROMPT_LEARNING_THRESHOLD);
    const section = generateEvolvedPromptSection(learnings);

    expect(section).not.toBeNull();
    expect(section).toContain("Auto-evolved session learnings");
    expect(section).toContain("Guest request 0");
  });

  it("selects evolved prompt as A/B winner when coverage + edge pass rate improve", () => {
    const learnings = buildSyntheticLearnings(PROMPT_LEARNING_THRESHOLD);
    const evolved = generateEvolvedPromptSection(learnings)!;
    const edgeScenarios = mergeProductionEdgeCases([]);

    const result = evaluatePromptAbTest({
      baselineSection: "",
      evolvedSection: evolved,
      learnings,
      edgeScenarios,
    });

    expect(result.variantB.learningCoverage).toBeGreaterThan(
      result.variantA.learningCoverage
    );
    expect(selectPromptWinner(result)).toBe("evolved");
    expect(
      canAutoDeployPromptEvolution(
        { ...result, winner: "B", confidence: 0.96 },
        true
      )
    ).toBe(true);
    expect(canAutoDeployPromptEvolution(result, false)).toBe(false);
  });
});

describe("production edge fixtures", () => {
  it("seed production edge cases pass kernel eval", () => {
    for (const scenario of mergeProductionEdgeCases([])) {
      expect(runDenisScenario(scenario).passed).toBe(true);
    }
  });

  it("converts misunderstood production learning into eval fixture", () => {
    const learnings = extractSessionLearnings({
      sessionId: "sess-bad",
      messages: badSessionMessages(),
    });

    const mismatch = learnings.find((row) => row.kind === "mismatch");
    expect(mismatch).toBeTruthy();

    const timeline: DenisTimelineRow[] = [
      {
        id: "1",
        ai_session_id: "ai-1",
        seq: 1,
        event_type: "perception.ingested",
        trace_id: "trace-1",
        context_hash: null,
        created_at: "2026-06-01T12:00:00.000Z",
        payload: {
          type: "perception.ingested",
          frame: {
            channel: "chat.message",
            normalizedText: mismatch!.guestMessage,
            structuredIntent: null,
            ingestedAt: "2026-06-01T12:00:00.000Z",
          },
          envelope: { traceId: "trace-1", surface: "chat" },
        },
      },
    ];

    expect(timeline[0].event_type).toBe("perception.ingested");
  });
});
