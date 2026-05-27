import { apiSuccess } from "@/lib/api-response";
import type { LegacyChatSuccessData } from "@/lib/denis/surfaces/chat/format-turn-response";
import type { DenisTurnMeta } from "@/lib/denis/runtime/turn-types";
import { formatDenisApiMeta } from "@/lib/denis/surfaces/format-denis-api-meta";

export type VoiceTurnApiExtras = {
  speakText: string;
  ttsRecommended: boolean;
};

/** L4 — voice out envelope: chat fields + TTS hint for guest Web Speech API. */
export function formatVoiceTurnApiResponse(
  data: LegacyChatSuccessData,
  meta: DenisTurnMeta,
  voice: VoiceTurnApiExtras
) {
  return apiSuccess({
    ...data,
    voice,
    denis: formatDenisApiMeta(meta),
  });
}
