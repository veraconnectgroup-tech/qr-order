import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { synthesizeDenisSpeech } from "@/lib/ai/openai-tts";
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
