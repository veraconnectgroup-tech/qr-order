import { apiSuccess } from "@/lib/api-response";
import type { LegacyChatSuccessData } from "@/lib/denis/surfaces/chat/format-turn-response";
import type { DenisTurnMeta } from "@/lib/denis/runtime/turn-types";

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
    denis: {
      traceId: meta.traceId,
      channel: meta.channel,
      flowNodeId: meta.flowNodeId,
      topGoal: meta.topGoal,
      conflictPrompt: meta.conflictPrompt,
      narrationTier: meta.narrationTier,
      lintPassed: meta.lintPassed,
      usedNarrationFallback: meta.usedNarrationFallback,
      rolloutMode: meta.rolloutMode,
      partyMode: meta.partyMode,
      partyDeviceCount: meta.partyDeviceCount,
      isPrimaryDevice: meta.isPrimaryDevice,
      sharedAiSessionId: meta.sharedAiSessionId,
      operatingMode: meta.operatingMode,
      kdsStress: meta.kdsStress,
    },
  });
}
