import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callOpenAiChatStreaming,
  resetAiCircuitBreakerForTests,
} from "@/lib/ai/openai-client";

function sseBody(rawChunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of rawChunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function sseEvent(delta: string, model = "gpt-4.1"): string {
  return `data: ${JSON.stringify({
    model,
    choices: [{ delta: { content: delta } }],
  })}\n\n`;
}

function sseUsageEvent(): string {
  return `data: ${JSON.stringify({
    model: "gpt-4.1",
    choices: [{ delta: {} }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  })}\n\n`;
}

describe("callOpenAiChatStreaming", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    resetAiCircuitBreakerForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reveals the message field incrementally and returns the full content at the end", async () => {
    const fullJson = '{"message":"Dobro vece, izvolite?","intent":"chat"}';
    // Split the JSON across several SSE token deltas, independent of field boundaries.
    const pieces = [
      '{"mess',
      'age":"Dobro ',
      'vece, izvo',
      'lite?","in',
      'tent":"chat"}',
    ];

    const rawChunks = [
      ...pieces.map((p) => sseEvent(p)),
      sseUsageEvent(),
      "data: [DONE]\n\n",
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(sseBody(rawChunks), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const result = await callOpenAiChatStreaming(
      [{ role: "user", content: "jedno pivo" }],
      (text) => deltas.push(text)
    );

    expect(deltas.join("")).toBe("Dobro vece, izvolite?");
    expect(result.content).toBe(fullJson);
    expect(result.tokensUsed).toBe(120);
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(20);
    expect(result.model).toBe("gpt-4.1");
  });

  it("throws when OpenAI responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad request" } }), {
        status: 400,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callOpenAiChatStreaming([{ role: "user", content: "hi" }], () => {})
    ).rejects.toThrow("bad request");
  });

  it("throws when the stream completes with no content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(sseBody(["data: [DONE]\n\n"]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callOpenAiChatStreaming([{ role: "user", content: "hi" }], () => {})
    ).rejects.toThrow("empty response");
  });
});
