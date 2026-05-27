export { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
export type { LegacyChatSuccessData } from "@/lib/denis/surfaces/chat/format-turn-response";
export { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
export { inferDenisChannelFromBody } from "@/lib/denis/surfaces/voice/infer-denis-channel";
export { normalizeVoiceTranscript } from "@/lib/denis/surfaces/voice/normalize-transcript";
export { parseDenisVoiceBody } from "@/lib/denis/surfaces/voice/parse-voice-turn";
export {
  formatVoiceTurnApiResponse,
  type VoiceTurnApiExtras,
} from "@/lib/denis/surfaces/voice/format-voice-response";

/** L4 Surfaces — chat + voice formatters (M7, M18). */
export const DENIS_SURFACES_LAYER = "surfaces" as const;
