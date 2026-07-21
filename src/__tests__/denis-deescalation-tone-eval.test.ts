import { afterEach, describe, expect, it, vi } from "vitest";
import { DEESCALATION_SCENARIOS } from "@/lib/denis/eval/fixtures/deescalation/scenarios";

/**
 * Blind-spot eval #1 (quality-audit follow-up): the conduct ladder's
 * mechanical wiring is covered elsewhere (resolve-act-acl.test.ts /
 * denis-floor.test.ts assert the RIGHT tier fires) but nothing scored
 * whether the actual WARN_1/WARN_2/HANDOFF text is good de-escalation
 * copy. This suite runs the real production strings (imported from
 * resolve-guest-conduct-policy.ts, not hand-copied) through an LLM judge.
 */
describe("de-escalation tone eval (LLM judge)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("has a real, non-trivial fixture set spanning sr/de and all three tiers", () => {
    expect(DEESCALATION_SCENARIOS.length).toBeGreaterThanOrEqual(6);
    const tiers = new Set(DEESCALATION_SCENARIOS.map((s) => s.tier));
    expect(tiers).toEqual(new Set(["warn_1", "warn_2", "handoff"]));
    const languages = DEESCALATION_SCENARIOS.map((s) => s.id.slice(0, 2));
    expect(languages).toContain("sr");
    expect(languages).toContain("de");
  });

  it("passes when the judge scores the real production strings well", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          deescalatesScore: 8,
          boundaryClearScore: 8,
          professionalToneScore: 8,
          submissive: false,
          critique: "Calm, clear boundary, no groveling.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));

    const { runDeescalationToneEval } = await import(
      "@/lib/denis/eval/run-deescalation-tone-eval"
    );
    const report = await runDeescalationToneEval();

    expect(report.scenarioCount).toBe(DEESCALATION_SCENARIOS.length);
    expect(report.unjudged).toBe(0);
    expect(report.ok).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("fails the gate when a reply is judged submissive, even with high scores", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          deescalatesScore: 9,
          boundaryClearScore: 8,
          professionalToneScore: 8,
          submissive: true,
          critique: "Reads as apologetic rather than holding a boundary.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));

    const { runDeescalationToneEval } = await import(
      "@/lib/denis/eval/run-deescalation-tone-eval"
    );
    const report = await runDeescalationToneEval();

    expect(report.ok).toBe(false);
    expect(report.results.every((r) => !r.passed)).toBe(true);
    expect(report.results[0].errors.join(" ")).toMatch(/submissive/);
  });

  it("fails the gate (not a silent pass) when a score falls below the 7/10 bar", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          deescalatesScore: 4,
          boundaryClearScore: 8,
          professionalToneScore: 8,
          submissive: false,
          critique: "Reply escalates rather than calming the guest down.",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));

    const { runDeescalationToneEval } = await import(
      "@/lib/denis/eval/run-deescalation-tone-eval"
    );
    const report = await runDeescalationToneEval();

    expect(report.ok).toBe(false);
    expect(
      report.results.every((r) => r.errors.some((e) => e.includes("deescalatesScore")))
    ).toBe(true);
  });

  it("treats an unjudgeable scenario (no OpenAI key) as a failure, not a pass", async () => {
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));

    const { runDeescalationToneEval } = await import(
      "@/lib/denis/eval/run-deescalation-tone-eval"
    );
    const report = await runDeescalationToneEval();

    expect(report.ok).toBe(false);
    expect(report.unjudged).toBe(DEESCALATION_SCENARIOS.length);
  });
});
