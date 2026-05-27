import type { DenisTurnMeta } from "@/lib/denis/runtime/turn-types";

/** Guest-visible Denis envelope on chat/voice API responses. */
export function formatDenisApiMeta(meta: DenisTurnMeta) {
  return {
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
    actSubmitLive: meta.actSubmitLive,
    actSubmitAttempted: meta.actSubmitAttempted,
    actOrderNumber: meta.actOrderNumber,
  };
}

export type DenisGuestApiMeta = ReturnType<typeof formatDenisApiMeta>;
