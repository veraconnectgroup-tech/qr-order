import { afterEach, describe, expect, it, vi } from "vitest";
import { MULTILINGUAL_QUALITY_SCENARIOS } from "@/lib/denis/eval/fixtures/multilingual-quality/scenarios";

/**
 * Blind-spot eval #2 (quality-audit follow-up): most eval fixtures are
 * sr/de — nothing scored actual reply QUALITY (naturalness/correctness,
 * not just "responded in the right language") for fr/es/ru. This suite
 * judges realistic guest/reply pairs in those three languages.
 */
describe("multilingual reply quality eval (LLM judge)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("covers fr, es, and ru with realistic, non-trivial guest messages", () => {
    expect(MULTILINGUAL_QUALITY_SCENARIOS.length).toBeGreaterThanOrEqual(6);
    const languages = new Set(MULTILINGUAL_QUALITY_SCENARIOS.map((s) => s.language));
    expect(languages).toEqual(new Set(["fr", "es", "ru"]));
  });

  it("passes when the judge scores the realistic replies well", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          score: 8,
          meetsBar: true,
          issues: [],
          critique: "Natural, fluent, answers the guest directly.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));

    const { runMultilingualQualityEval } = await import(
      "@/lib/denis/eval/run-multilingual-quality-eval"
    );
    const report = await runMultilingualQualityEval();

    expect(report.scenarioCount).toBe(MULTILINGUAL_QUALITY_SCENARIOS.length);
    expect(report.unjudged).toBe(0);
    expect(report.ok).toBe(true);
  });

  it("fails the gate when phrasing is judged unnatural / below the 7/10 bar", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          score: 3,
          meetsBar: false,
          issues: ["reads like a literal translation", "wrong verb agreement"],
          critique: "Grammatically off and doesn't sound native.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));

    const { runMultilingualQualityEval } = await import(
      "@/lib/denis/eval/run-multilingual-quality-eval"
    );
    const report = await runMultilingualQualityEval();

    expect(report.ok).toBe(false);
    expect(report.results.every((r) => !r.passed)).toBe(true);
  });

  it("treats an unjudgeable scenario (no OpenAI key) as a failure, not a silent pass", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));

    const { runMultilingualQualityEval } = await import(
      "@/lib/denis/eval/run-multilingual-quality-eval"
    );
    const report = await runMultilingualQualityEval();

    expect(report.ok).toBe(false);
    expect(report.unjudged).toBe(MULTILINGUAL_QUALITY_SCENARIOS.length);
  });
});
