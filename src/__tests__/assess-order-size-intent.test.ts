import { afterEach, describe, expect, it, vi } from "vitest";

describe("assessOrderSizeIntent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns a parsed assessment for a generic category request", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          namesSpecificProduct: false,
          productNameGuess: null,
          isGenericDrinkRequest: true,
          genericCategoryGuess: "beer",
          sizePreference: "unspecified",
          confidence: 0.9,
          quotedSpan: "jedno pivo",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSizeIntent } = await import(
      "@/lib/denis/cognition/perceive/assess-order-size-intent"
    );

    const result = await assessOrderSizeIntent("jedno pivo");

    expect(result?.isGenericDrinkRequest).toBe(true);
    expect(result?.genericCategoryGuess).toBe("beer");
  });

  it("returns a parsed assessment for a named product with a size preference, in any language/phrasing", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          namesSpecificProduct: true,
          productNameGuess: "Pilsner",
          isGenericDrinkRequest: false,
          genericCategoryGuess: null,
          sizePreference: "larger",
          confidence: 0.85,
          quotedSpan: "veliko Pilsner",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSizeIntent } = await import(
      "@/lib/denis/cognition/perceive/assess-order-size-intent"
    );

    const result = await assessOrderSizeIntent("veliko Pilsner");

    expect(result?.namesSpecificProduct).toBe(true);
    expect(result?.productNameGuess).toBe("Pilsner");
    expect(result?.sizePreference).toBe("larger");
  });

  it("returns null when OpenAI is not configured", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    const { assessOrderSizeIntent } = await import(
      "@/lib/denis/cognition/perceive/assess-order-size-intent"
    );

    const result = await assessOrderSizeIntent("jedno pivo");

    expect(result).toBeNull();
  });

  it("returns null for an empty message without calling the LLM", async () => {
    const callOpenAiChat = vi.fn();
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSizeIntent } = await import(
      "@/lib/denis/cognition/perceive/assess-order-size-intent"
    );

    const result = await assessOrderSizeIntent("   ");

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
    const { assessOrderSizeIntent } = await import(
      "@/lib/denis/cognition/perceive/assess-order-size-intent"
    );

    const result = await assessOrderSizeIntent("jedno pivo");

    expect(result).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { assessOrderSizeIntent } = await import(
      "@/lib/denis/cognition/perceive/assess-order-size-intent"
    );

    const result = await assessOrderSizeIntent("jedno pivo");

    expect(result).toBeNull();
  });
});
