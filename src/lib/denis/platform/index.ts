export {
  appendDenisTimelineEvent,
  loadDenisTimeline,
} from "@/lib/denis/platform/append-timeline-event";
export {
  buildTurnEnvelope,
  createTurnTraceId,
} from "@/lib/denis/platform/timeline-types";
export type {
  AppendTimelineEventInput,
  DenisTimelineEventPayload,
  DenisTimelineEventType,
  DenisTimelineRow,
  GuestIntent,
  PerceptionChannel,
  PerceptionFrame,
  TurnEnvelope,
} from "@/lib/denis/platform/timeline-types";
export {
  DENIS_RISK_CLASSES,
  DEFAULT_ROLLOUT_MODE,
  defaultRiskForNarrationTier,
  isRiskClassAllowedInRollout,
} from "@/lib/denis/platform/risk-levels";
export type { DenisRiskClass, RolloutMode } from "@/lib/denis/platform/risk-levels";

/** L1 Platform layer marker — M2 timeline. */
export const DENIS_PLATFORM_LAYER = "platform" as const;
