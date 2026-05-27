import { apiSuccess } from "@/lib/api-response";
import type { DenisTurnMeta } from "@/lib/denis/runtime/turn-types";

export type LegacyChatSuccessData = {
  message: string;
  recommendations?: unknown[];
  cartActions?: unknown[];
  quickReplies?: string[];
  intent?: string;
  submitOrder?: boolean;
  creditsRemaining?: number;
  sessionId?: string;
};

/** L4 — chat API envelope (no business logic). */
export function formatChatTurnApiResponse(
  data: LegacyChatSuccessData,
  meta: DenisTurnMeta
) {
  return apiSuccess({
    ...data,
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
    },
  });
}
