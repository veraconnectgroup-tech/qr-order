import { apiError } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/api/with-error-handler";
import { AiOpenAiError } from "@/lib/ai/openai-client";
import { streamDenisSpeech } from "@/lib/ai/openai-tts";
import { resolveDenisVoiceInstructions } from "@/lib/ai/denis-voice-instructions";
import { loadStationVoiceSnapshot } from "@/lib/denis/venue/floor/load-station-voice-snapshot";
import { withRateLimitByKey } from "@/lib/rate-limit";
import { isUuid } from "@/lib/security/sanitize";
import { zSessionToken } from "@/lib/security/zod-fields";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_TTS_TEXT_LENGTH = 2000;
const STATION_VALUES = new Set(["kitchen", "bar"]);

function optionalRatio(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalStation(value: unknown): "kitchen" | "bar" | undefined {
  return typeof value === "string" && STATION_VALUES.has(value)
    ? (value as "kitchen" | "bar")
    : undefined;
}

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

  const moodInput = body as {
    urgencyRatio?: unknown;
    venueChaosRatio?: unknown;
    relationshipWarmth?: unknown;
    station?: unknown;
  };
  const urgencyRatio = optionalRatio(moodInput.urgencyRatio) ?? 0;
  const relationshipWarmth = optionalRatio(moodInput.relationshipWarmth);
  const station = optionalStation(moodInput.station);

  // Station-voice calls carry the locationId as sessionToken — recompute
  // venueChaosRatio server-side from real order backlog instead of trusting
  // whatever the client sent (the client can't see backlog data at all).
  let venueChaosRatio = optionalRatio(moodInput.venueChaosRatio);
  if (station && isUuid(sessionTokenParsed.data)) {
    const snapshot = await loadStationVoiceSnapshot(
      createAdminClient(),
      sessionTokenParsed.data,
      station
    );
    venueChaosRatio = snapshot.venueChaosRatio;
  }

  try {
    // Pipe OpenAI's bytes straight to the client as they arrive instead of
    // buffering the full file server-side first — overlaps generation and
    // transfer instead of waiting for both in sequence.
    const stream = await streamDenisSpeech(
      text.trim(),
      resolveDenisVoiceInstructions({
        urgencyRatio,
        venueChaosRatio,
        relationshipWarmth,
      })
    );
    return new Response(stream, {
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
