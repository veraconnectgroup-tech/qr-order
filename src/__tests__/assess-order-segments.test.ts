import { afterEach, describe, expect, it, vi } from "vitest";

describe("assessOrderSegments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns parsed multi-item segments for a group order", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          isOrderPlacement: true,
          segments: [
            {
              quotedSpan: "za mene burger",
              quantity: 1,
              personaHint: "za mene",
              productNameGuess: "burger",
              isGenericCategory: false,
              categoryGuess: null,
              modifierText: null,
            },
            {
              quotedSpan: "jedno pivo",
              quantity: 1,
              personaHint: null,
              productNameGuess: null,
              isGenericCategory: true,
              categoryGuess: "beer",
              modifierText: null,
            },
          ],
          confidence: 0.9,
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSegments } = await import(
      "@/lib/denis/cognition/perceive/assess-order-segments"
    );

    const result = await assessOrderSegments("za mene burger i jedno pivo");

    expect(result?.isOrderPlacement).toBe(true);
    expect(result?.segments).toHaveLength(2);
    expect(result?.segments[1]?.isGenericCategory).toBe(true);
  });

  it("returns null when OpenAI is not configured", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    const { assessOrderSegments } = await import(
      "@/lib/denis/cognition/perceive/assess-order-segments"
    );

    const result = await assessOrderSegments("jedno pivo");

    expect(result).toBeNull();
  });

  it("returns null for an empty message without calling the LLM", async () => {
    const callOpenAiChat = vi.fn();
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSegments } = await import(
      "@/lib/denis/cognition/perceive/assess-order-segments"
    );

    const result = await assessOrderSegments("   ");

    expect(result).toBeNull();
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
    const { assessOrderSegments } = await import(
      "@/lib/denis/cognition/perceive/assess-order-segments"
    );

    const result = await assessOrderSegments("jedno pivo");

    expect(result).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSegments } = await import(
      "@/lib/denis/cognition/perceive/assess-order-segments"
    );

    const result = await assessOrderSegments("jedno pivo");

    expect(result).toBeNull();
  });
});
