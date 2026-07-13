import { afterEach, describe, expect, it, vi } from "vitest";

describe("assessRuleCandidate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("extracts a permanent rule candidate from a colleague's answer", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          present: true,
          ruleText: "We can always swap fries for salad.",
          scopeClaim: "permanent",
          confidence: 0.9,
          quotedSpan: "yeah we can always do that",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessRuleCandidate } = await import(
      "@/lib/denis/cognition/perceive/assess-rule-candidate"
    );

    const result = await assessRuleCandidate("yeah we can always do that");

    expect(result?.present).toBe(true);
    expect(result?.scopeClaim).toBe("permanent");
  });

  it("returns null when OpenAI is not configured", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    const { assessRuleCandidate } = await import(
      "@/lib/denis/cognition/perceive/assess-rule-candidate"
    );

    expect(await assessRuleCandidate("some answer")).toBeNull();
  });

  it("returns null for an empty answer without calling the LLM", async () => {
    const callOpenAiChat = vi.fn();
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessRuleCandidate } = await import(
      "@/lib/denis/cognition/perceive/assess-rule-candidate"
    );

    expect(await assessRuleCandidate("   ")).toBeNull();
    expect(callOpenAiChat).not.toHaveBeenCalled();
  });

  it("returns null on malformed LLM output instead of throwing", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: "not json",
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessRuleCandidate } = await import(
      "@/lib/denis/cognition/perceive/assess-rule-candidate"
    );

    expect(await assessRuleCandidate("some answer")).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessRuleCandidate } = await import(
      "@/lib/denis/cognition/perceive/assess-rule-candidate"
    );

    expect(await assessRuleCandidate("some answer")).toBeNull();
  });
});
