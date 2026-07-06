import { isOpenAiConfigured } from "@/lib/ai/config";
import { AiOpenAiError } from "@/lib/ai/openai-client";

const OPENAI_TTS_URL =
  process.env.OPENAI_TTS_API_URL?.trim() ||
  "https://api.openai.com/v1/audio/speech";

/** Fixed brand voice — consistent across every guest device (browser TTS varies per OS/browser). */
const DENIS_TTS_VOICE = "alloy";
/** gpt-4o-mini-tts supports a natural-language `instructions` field for delivery/tone — same
 * voice identity every time, only how it's spoken shifts (e.g. calmer vs. more urgent). */
const DENIS_TTS_MODEL = "gpt-4o-mini-tts";

export async function synthesizeDenisSpeech(
  text: string,
  instructions?: string
): Promise<ArrayBuffer> {
  if (!isOpenAiConfigured()) {
    throw new AiOpenAiError("OpenAI is not configured.");
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim();

  const res = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DENIS_TTS_MODEL,
      voice: DENIS_TTS_VOICE,
      input: text,
      response_format: "mp3",
      ...(instructions ? { instructions } : {}),
    }),
  });

  if (!res.ok) {
    let message = `OpenAI TTS request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore — keep default message
    }
    throw new AiOpenAiError(message, res.status);
  }

  return res.arrayBuffer();
}
