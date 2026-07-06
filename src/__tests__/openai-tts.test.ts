import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamDenisSpeech, synthesizeDenisSpeech } from "@/lib/ai/openai-tts";
import { AiOpenAiError } from "@/lib/ai/openai-client";

describe("synthesizeDenisSpeech", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the text to OpenAI's TTS endpoint and returns the audio bytes", async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(audioBytes, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeDenisSpeech("Dobro vece!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    const requestBody = JSON.parse((init as RequestInit).body as string);
    expect(requestBody.input).toBe("Dobro vece!");
    expect(requestBody.voice).toBeTruthy();
    expect(requestBody.model).toBeTruthy();

    expect(new Uint8Array(result)).toEqual(new Uint8Array(audioBytes));
  });

  it("throws AiOpenAiError with the upstream message on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad voice" } }), {
        status: 400,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeDenisSpeech("hi")).rejects.toThrow("bad voice");
  });

  it("throws when OpenAI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(synthesizeDenisSpeech("hi")).rejects.toThrow(AiOpenAiError);
  });
});

describe("streamDenisSpeech", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hands back the raw response stream instead of buffering it", async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(audioBytes, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const stream = await streamDenisSpeech("Dobro vece!");
    expect(stream).toBeInstanceOf(ReadableStream);

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    expect(total).toBe(4);
  });

  it("throws AiOpenAiError with the upstream message on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad voice" } }), {
        status: 400,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(streamDenisSpeech("hi")).rejects.toThrow("bad voice");
  });
});
