import { afterEach, describe, expect, it, vi } from "vitest";

describe("discoverEndpointCapability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns a parsed assessment for a matched capability", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          capability: "order.create",
          confidence: 0.85,
          quotedSpan: "Create a new order for this table",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { discoverEndpointCapability } = await import(
      "@/lib/denis/cognition/perceive/discover-endpoint-capability"
    );

    const result = await discoverEndpointCapability({
      method: "POST",
      path: "/tickets",
      operationId: "openTicket",
      summary: "Create a new order for this table",
      description: null,
    });

    expect(result?.capability).toBe("order.create");
    expect(result?.confidence).toBe(0.85);
  });

  it("returns capability 'none' when the endpoint doesn't map to anything known", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          capability: "none",
          confidence: 0.9,
          quotedSpan: "Configure webhook retry policy",
        }),
        tokensUsed: 10,
        promptTokens: 5,
        completionTokens: 5,
        model: "test",
      }),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { discoverEndpointCapability } = await import(
      "@/lib/denis/cognition/perceive/discover-endpoint-capability"
    );

    const result = await discoverEndpointCapability({
      method: "PUT",
      path: "/webhooks/retry-policy",
      operationId: null,
      summary: "Configure webhook retry policy",
      description: null,
    });

    expect(result?.capability).toBe("none");
  });

  it("returns null when OpenAI is not configured", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({ callOpenAiChat: vi.fn() }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => false }));
    const { discoverEndpointCapability } = await import(
      "@/lib/denis/cognition/perceive/discover-endpoint-capability"
    );

    const result = await discoverEndpointCapability({
      method: "GET",
      path: "/x",
      operationId: null,
      summary: null,
      description: null,
    });

    expect(result).toBeNull();
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
    const { discoverEndpointCapability } = await import(
      "@/lib/denis/cognition/perceive/discover-endpoint-capability"
    );

    const result = await discoverEndpointCapability({
      method: "GET",
      path: "/x",
      operationId: null,
      summary: null,
      description: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    vi.doMock("@/lib/ai/openai-client", () => ({
      callOpenAiChat: vi.fn().mockRejectedValue(new Error("network error")),
    }));
    vi.doMock("@/lib/ai/config", () => ({ isOpenAiConfigured: () => true }));
    const { discoverEndpointCapability } = await import(
      "@/lib/denis/cognition/perceive/discover-endpoint-capability"
    );

    const result = await discoverEndpointCapability({
      method: "GET",
      path: "/x",
      operationId: null,
      summary: null,
      description: null,
    });

    expect(result).toBeNull();
  });
});
