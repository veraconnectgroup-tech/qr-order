import { afterEach, describe, expect, it, vi } from "vitest";
import { VOICE_TURN_QUALITY_SCENARIOS } from "@/lib/denis/eval/fixtures/voice-turn-quality/scenarios";

/**
 * Blind-spot eval #3 (quality-audit follow-up): station-voice-turn-llm.ts
 * and interpret-station-voice-turn.ts have wiring tests (does the right
 * `answer` get resolved) but nothing scored whether the `speak` text is
 * actually good for a hands-busy kitchen/bar context. This suite runs
 * real transcripts through the real interpretStationVoiceTurn() pipeline
 * and judges the resulting speak text.
 *
 * Note on mocking: this test mocks assess-reply-quality.ts directly
 * (the judge boundary) rather than the underlying OpenAI client, because
 * interpretStationVoiceTurn's own LLM fallback branch
 * (perceiveStationVoiceTurnFromLlm) also gates on isOpenAiConfigured() /
 * callOpenAiChat() — mocking those globally would make an unrelated
 * scenario (the "unclear transcript" case) attempt a real LLM turn
 * instead of exercising its deterministic clarify-line fallback.
 */
describe("voice-turn reply quality eval (LLM judge)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("covers both kitchen and bar with realistic transcripts, including an unclear one", () => {
    expect(VOICE_TURN_QUALITY_SCENARIOS.length).toBeGreaterThanOrEqual(5);
    const stations = new Set(VOICE_TURN_QUALITY_SCENARIOS.map((s) => s.station));
    expect(stations).toEqual(new Set(["kitchen", "bar"]));
  });

  it("runs real transcripts through interpretStationVoiceTurn and produces non-empty speak text for every scenario", async () => {
    const { interpretStationVoiceTurn } = await import(
      "@/lib/denis/stations/interpret-station-voice-turn"
    );
    const { CONCIERGE_PLATFORM_DEFAULTS } = await import(
      "@/lib/denis/config/concierge-defaults"
    );

    for (const scenario of VOICE_TURN_QUALITY_SCENARIOS) {
      const result = await interpretStationVoiceTurn(
        {
          questionMessage: scenario.questionMessage,
          questionType: scenario.questionType,
          station: scenario.station,
          staffTranscript: scenario.staffTranscript,
          priorTurns: scenario.priorTurns,
          locationId: "eval-loc-voice-turn",
        },
        CONCIERGE_PLATFORM_DEFAULTS
      );
      expect(result.speak.length).toBeGreaterThan(0);
    }
  });

  it("passes the gate when the judge scores every speak line well", async () => {
    vi.doMock("@/lib/denis/cognition/perceive/assess-reply-quality", () => ({
      assessReplyQuality: vi.fn().mockResolvedValue({
        score: 8,
        meetsBar: true,
        issues: [],
        critique: "Short, concrete, exactly what a busy cook needs to hear.",
      }),
    }));

    const { runVoiceTurnQualityEval } = await import(
      "@/lib/denis/eval/run-voice-turn-quality-eval"
    );
    const report = await runVoiceTurnQualityEval();

    expect(report.scenarioCount).toBe(VOICE_TURN_QUALITY_SCENARIOS.length);
    expect(report.unjudged).toBe(0);
    expect(report.ok).toBe(true);
    for (const row of report.results) {
      expect(row.speak.length).toBeGreaterThan(0);
    }
  });

  it("fails the gate when the judge scores speak text as too wordy for the context", async () => {
    vi.doMock("@/lib/denis/cognition/perceive/assess-reply-quality", () => ({
      assessReplyQuality: vi.fn().mockResolvedValue({
        score: 4,
        meetsBar: false,
        issues: ["too long for a hands-busy context", "reads like a written report"],
        critique: "A cook mid-service would tune this out.",
      }),
    }));

    const { runVoiceTurnQualityEval } = await import(
      "@/lib/denis/eval/run-voice-turn-quality-eval"
    );
    const report = await runVoiceTurnQualityEval();

    expect(report.ok).toBe(false);
    expect(report.results.every((r) => !r.passed)).toBe(true);
  });

  it("treats an unjudgeable scenario as a failure, not a silent pass", async () => {
    vi.doMock("@/lib/denis/cognition/perceive/assess-reply-quality", () => ({
      assessReplyQuality: vi.fn().mockResolvedValue(null),
    }));

    const { runVoiceTurnQualityEval } = await import(
      "@/lib/denis/eval/run-voice-turn-quality-eval"
    );
    const report = await runVoiceTurnQualityEval();

    expect(report.ok).toBe(false);
    expect(report.unjudged).toBe(VOICE_TURN_QUALITY_SCENARIOS.length);
  });
});
