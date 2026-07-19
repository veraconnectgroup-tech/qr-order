import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callAnthropicChat,
  isAnthropicConfigured,
  isAnthropicModel,
  resetAnthropicCircuitBreakerForTests,
  stripAnthropicPrefix,
} from "@/lib/ai/anthropic-client";

function messagesResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("anthropic-client — second model provider for the extended tier", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    resetAnthropicCircuitBreakerForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("recognizes the anthropic: model prefix and strips it for the request", async () => {
    expect(isAnthropicModel("anthropic:claude-sonnet-5")).toBe(true);
    expect(isAnthropicModel("gpt-4.1")).toBe(false);
    expect(isAnthropicModel(undefined)).toBe(false);
    expect(stripAnthropicPrefix("anthropic:claude-sonnet-5")).toBe(
      "claude-sonnet-5"
    );
  });

  it("is configured only when ANTHROPIC_API_KEY is set", () => {
    expect(isAnthropicConfigured()).toBe(true);
    delete process.env.ANTHROPIC_API_KEY;
    expect(isAnthropicConfigured()).toBe(false);
  });

  it("splits system/user/assistant messages into Anthropic's shape and sends x-api-key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      messagesResponse({
        model: "claude-sonnet-5",
        content: [{ type: "text", text: '{"message":"hi"}' }],
        usage: { input_tokens: 20, output_tokens: 8 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAnthropicChat(
      [
        { role: "system", content: "You are Denis." },
        { role: "user", content: "2x cola" },
        { role: "assistant", content: "Got it." },
        { role: "user", content: "and a burger" },
      ],
      { model: "anthropic:claude-sonnet-5" }
    );

    expect(result.content).toBe('{"message":"hi"}');
    expect(result.tokensUsed).toBe(28);
    expect(result.promptTokens).toBe(20);
    expect(result.completionTokens).toBe(8);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("anthropic.com");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["anthropic-version"]).toBeTruthy();

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.system).toBe("You are Denis.");
    expect(body.messages).toEqual([
      { role: "user", content: "2x cola" },
      { role: "assistant", content: "Got it." },
      { role: "user", content: "and a burger" },
    ]);
  });

  it("throws AiAnthropicError on a non-ok response instead of returning empty content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "overloaded" } }), {
          status: 529,
        })
      )
    );

    await expect(
      callAnthropicChat([{ role: "user", content: "hi" }], {
        model: "anthropic:claude-sonnet-5",
      })
    ).rejects.toThrow("overloaded");
  });

  it("refuses to call out when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callAnthropicChat([{ role: "user", content: "hi" }], {
        model: "anthropic:claude-sonnet-5",
      })
    ).rejects.toThrow("Anthropic is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
