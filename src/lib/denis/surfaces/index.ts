export { formatChatTurnApiResponse } from "@/lib/denis/surfaces/chat/format-turn-response";
export type { LegacyChatSuccessData } from "@/lib/denis/surfaces/chat/format-turn-response";
export { parseDenisChatBody } from "@/lib/denis/surfaces/chat/parse-chat-request";
export { inferDenisChannelFromBody } from "@/lib/denis/surfaces/voice/infer-denis-channel";
export { normalizeVoiceTranscript } from "@/lib/denis/surfaces/voice/normalize-transcript";
export { parseDenisVoiceBody } from "@/lib/denis/surfaces/voice/parse-voice-turn";
export {
  detectVoiceLanguage,
} from "@/lib/denis/surfaces/voice/detect-voice-language";
export {
  isVoiceTranscriptConfident,
  shouldRetryVoiceCapture,
  VOICE_STT_MIN_CONFIDENCE,
} from "@/lib/denis/surfaces/voice/voice-confidence";
export {
  resolveVoiceTtsProfile,
  type VoiceTtsProfile,
} from "@/lib/denis/surfaces/voice/voice-tts-profile";
export {
  isSignalAboveNoiseGate,
  openVoiceAudioPipeline,
  VOICE_HIGHPASS_HZ,
  VOICE_LOWPASS_HZ,
  VOICE_NOISE_GATE_THRESHOLD,
} from "@/lib/denis/surfaces/voice/voice-audio-config";
export {
  formatVoiceTurnApiResponse,
  type VoiceTurnApiExtras,
} from "@/lib/denis/surfaces/voice/format-voice-response";

/** L4 Surfaces — chat + voice formatters (M7, M18). */
export const DENIS_SURFACES_LAYER = "surfaces" as const;
