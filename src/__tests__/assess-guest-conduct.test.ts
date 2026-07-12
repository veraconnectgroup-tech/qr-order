import { afterEach, describe, expect, it, vi } from "vitest";

describe("assessGuestConduct", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("calls the LLM for every message — no keyword/regex gate", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          toneTowardDenis: "respectful",
          directedAt: "unclear",
          confidence: 0.9,
          quotedSpan: "hteo bih pivo",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({
      isOpenAiConfigured: () => true,
    }));
    const { assessGuestConduct } = await import(
      "@/lib/denis/cognition/policy/assess-guest-conduct"
    );
    const { callOpenAiChat } = await import("@/lib/ai/openai-client");

    const result = await assessGuestConduct({ message: "hteo bih pivo" });

    expect(callOpenAiChat).toHaveBeenCalledTimes(1);
    expect(result?.toneTowardDenis).toBe("respectful");
  });

  it("returns a parsed assessment for a genuinely rude message", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          toneTowardDenis: "mild_insult",
          directedAt: "denis",
          confidence: 0.8,
          quotedSpan: "glup si",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({
      isOpenAiConfigured: () => true,
    }));
    const { assessGuestConduct } = await import(
      "@/lib/denis/cognition/policy/assess-guest-conduct"
    );

    const result = await assessGuestConduct({ message: "glup si Denise" });

    expect(result?.toneTowardDenis).toBe("mild_insult");
    expect(result?.directedAt).toBe("denis");
    expect(result?.confidence).toBe(0.8);
  });

  it("returns null when OpenAI is not configured", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn(),
    }));
    vi.doMock("@/lib/ai/config", () => ({
      isOpenAiConfigured: () => false,
    }));
    const { assessGuestConduct } = await import(
      "@/lib/denis/cognition/policy/assess-guest-conduct"
    );
    const { callOpenAiChat } = await import("@/lib/ai/openai-client");

    const result = await assessGuestConduct({ message: "glup si" });

    expect(result).toBeNull();
    expect(callOpenAiChat).not.toHaveBeenCalled();
  });

  it("returns null on malformed LLM output instead of throwing", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: "not json at all",
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({
      isOpenAiConfigured: () => true,
    }));
    const { assessGuestConduct } = await import(
      "@/lib/denis/cognition/policy/assess-guest-conduct"
    );

    const result = await assessGuestConduct({ message: "glup si" });

    expect(result).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.doMock("@/lib/ai/config", () => ({
      isOpenAiConfigured: () => true,
    }));
    const { assessGuestConduct } = await import(
      "@/lib/denis/cognition/policy/assess-guest-conduct"
    );

    const result = await assessGuestConduct({ message: "bilo šta" });

    expect(result).toBeNull();
  });
});
