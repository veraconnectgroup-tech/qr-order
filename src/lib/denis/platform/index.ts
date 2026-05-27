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
export type {
  FlowDefinition,
  FlowGuardContext,
  FlowNode,
  FlowNodeId,
  FlowNodePlan,
  FlowSignal,
  FlowTransitionResult,
} from "@/lib/denis/platform/flow-types";
export type { FlowProjection } from "@/lib/denis/platform/fold-flow";
export {
  cartFlowSignals,
  describeFlowNode,
  intentToFlowSignal,
  resolveFlowTransition,
} from "@/lib/denis/platform/flow-engine";
export { foldFlowProjection, emptyFlowProjection } from "@/lib/denis/platform/fold-flow";
export { getFlowPreset, parseFlowDefinition } from "@/lib/denis/platform/load-flow-preset";
export {
  denisSenseRequestSchema,
  denisSenseChannelSchema,
  manualCartSnapshotSchema,
  senseChannelToPerception,
} from "@/lib/denis/platform/sense-types";
export type {
  DenisSenseChannel,
  DenisSenseRequest,
  ManualCartSnapshotInput,
} from "@/lib/denis/platform/sense-types";

/** L1 Platform layer marker — M2 timeline, M3 Flow DSL. */
export const DENIS_PLATFORM_LAYER = "platform" as const;
