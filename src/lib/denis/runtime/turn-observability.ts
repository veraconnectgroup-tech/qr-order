import { logger } from "@/lib/logger";

export type TurnPhaseTimings = {
  contextMs: number;
  legacyMs: number;
  actMs: number;
  narrateMs: number;
  timelineMs: number;
  meteringMs: number;
  totalMs: number;
};

export type DenisTurnObservabilityPayload = {
  traceId: string;
  locationId: string;
  channel: "chat" | "voice";
  rolloutMode: string;
  guestUsesLegacy: boolean;
  narrationTier: string;
  lintPassed: boolean;
  creditsCharged: number;
  actDryRun: boolean;
  actEnabled: boolean;
  actSubmitLive?: boolean;
  actSubmitAttempted?: boolean;
  actOrderNumber?: number;
  shadowParityScore?: number;
  /** ADR-023 MR-3 — TDE turn profile metadata. */
  llmUsed?: boolean;
  planKind?: string;
  tier?: string;
  evidencePointers?: string[];
  timings: TurnPhaseTimings;
};

/** ADR-010 F8-1 / ADR-006 §5 — structured production turn log. */
export function logDenisTurnObservability(
  payload: DenisTurnObservabilityPayload
): void {
  logger.info("denis.turn.completed", {
    traceId: payload.traceId,
    locationId: payload.locationId,
    channel: payload.channel,
    rolloutMode: payload.rolloutMode,
    guestUsesLegacy: payload.guestUsesLegacy,
    narrationTier: payload.narrationTier,
    lintPassed: payload.lintPassed,
    creditsCharged: payload.creditsCharged,
    actDryRun: payload.actDryRun,
    actEnabled: payload.actEnabled,
    actSubmitLive: payload.actSubmitLive,
    actSubmitAttempted: payload.actSubmitAttempted,
    actOrderNumber: payload.actOrderNumber,
    shadowParityScore: payload.shadowParityScore,
    llmUsed: payload.llmUsed,
    planKind: payload.planKind,
    tier: payload.tier,
    evidencePointers: payload.evidencePointers,
    latencyMs: payload.timings,
  });
}

export function emptyTurnTimings(): TurnPhaseTimings {
  return {
    contextMs: 0,
    legacyMs: 0,
    actMs: 0,
    narrateMs: 0,
    timelineMs: 0,
    meteringMs: 0,
    totalMs: 0,
  };
}

export function elapsedMs(since: number): number {
  return Math.round(performance.now() - since);
}
