import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { synthesizeDenisSpeech } from "@/lib/ai/openai-tts";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { zSessionToken } from "@/lib/security/zod-fields";

const MAX_TTS_TEXT_LENGTH = 2000;

/** Guest-facing Denis TTS — brand voice via OpenAI, not device-dependent browser TTS. */
export const POST = withErrorHandler("ai-voice-speak-post", async (req, _ctx) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("Invalid input.", 400);
  }

  const text = (body as { text?: string }).text;
  if (typeof text !== "string" || !text.trim()) {
    return apiError("Invalid input.", 400);
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return apiError("Text too long.", 400);
  }

  const sessionTokenParsed = zSessionToken().safeParse(
    (body as { sessionToken?: string }).sessionToken ?? ""
  );
  if (!sessionTokenParsed.success) {
    return apiError("Invalid input.", 400);
  }

  const limited = await withRateLimitByKey("ai", sessionTokenParsed.data);
  if (limited) return limited;

  try {
    const audio = await synthesizeDenisSpeech(text.trim());
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AiOpenAiError) {
      return apiError(error.message, error.status ?? 502);
    }
    return apiError("Voice synthesis failed.", 500);
  }
});
