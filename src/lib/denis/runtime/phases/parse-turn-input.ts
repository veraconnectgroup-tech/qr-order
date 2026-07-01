import type { DenisTurnRunInput, ParsedTurnInput } from "@/lib/denis/runtime/phases/phase-types";
import { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
import { parseDenisVoiceBody } from "@/lib/denis/surfaces/voice/parse-voice-turn";
import { apiError } from "@/lib/api-response";

function isSupportedTurnChannel(
  channel: DenisTurnRunInput["channel"]
): channel is "chat" | "voice" {
  return channel === "chat" || channel === "voice";
}

export function parseTurnInput(input: DenisTurnRunInput): ParsedTurnInput {
  if (!isSupportedTurnChannel(input.channel)) {
    return { ok: false, response: apiError("Unsupported channel.", 400) };
  }

  const parsed =
    input.channel === "voice"
      ? parseDenisVoiceBody(input.rawBody)
      : parseDenisChatBody(input.rawBody);

  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, channel: input.channel, data: parsed.data };
}
