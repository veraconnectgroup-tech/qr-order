import { apiError } from "@/lib/api-response";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { normalizeVoiceTranscript } from "@/lib/denis/surfaces/voice/normalize-transcript";

export function parseDenisVoiceBody(rawBody: unknown) {
  const parsed = parseDenisChatBody(rawBody);
  if (!parsed.ok) {
    return parsed;
  }

  const normalized = normalizeVoiceTranscript(parsed.data.message);
  if (!normalized) {
    return {
      ok: false as const,
      response: apiError("Empty voice transcript.", 400),
    };
  }

  return {
    ok: true as const,
    data: {
      ...parsed.data,
      message: normalized,
    },
  };
}
