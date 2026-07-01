export {
  aggregateTurnSamples,
  DEFAULT_DENIS_HEALTH_CONTRACT,
  evaluateDenisHealth,
  HEALTH_DEGRADED_PROACTIVE_MS,
  HEALTH_LLM_ERROR_CRITICAL_RATE,
  HEALTH_REFUSAL_CRITICAL_RATE,
  HEALTH_REFUSAL_DEGRADED_RATE,
  HEALTH_RESPONSE_DEGRADED_MS,
  HEALTH_RESPONSE_HEALTHY_MS,
  HEALTH_STUCK_SESSION_MS,
  buildHealthOpsPatch,
  shouldForceT0Only,
  shouldReduceProactiveFrequency,
} from "@/lib/denis/monitoring/denis-health";
export type {
  AutoAction,
  DenisHealthContract,
  DenisHealthEvaluation,
  DenisHealthMetrics,
  HealthStatus,
  HealthOpsPatch,
  HealthTurnSample,
} from "@/lib/denis/monitoring/denis-health";
export {
  clearSessionTurnPending,
  incrementLoopDetectionCount,
  loadDenisHealthMetrics,
  markSessionTurnPending,
  recordHealthTurnSample,
} from "@/lib/denis/monitoring/health-metrics-store";
export {
  applyHealthStateTransition,
  loadStoredHealthState,
  markHealthAlertSent,
  shouldEmitHealthAlert,
} from "@/lib/denis/monitoring/health-state";
export {
  buildLoopRecoveryContent,
  detectConversationLoop,
  extractConversationMessages,
  messagesAreSimilar,
  normalizeForCompare,
  resolveLoopRecoveryAfterAttempts,
  shouldSkipLlmForLoop,
  textSimilarity,
  MAX_RECOVERY_ATTEMPTS,
} from "@/lib/denis/monitoring/loop-detection";
export type {
  ConversationMessage,
  LoopDetection,
  LoopRecoveryAction,
  LoopRecoveryContent,
  LoopType,
} from "@/lib/denis/monitoring/loop-detection";
export {
  clearLoopRecoveryAttempts,
  getLoopRecoveryAttempts,
  incrementLoopRecoveryAttempts,
} from "@/lib/denis/monitoring/loop-recovery-store";
export type {
  HealthFeatureLevel,
  StoredHealthState,
} from "@/lib/denis/monitoring/health-state";
export {
  applyDegradationTransition,
  healthMetricsToDegradationInput,
  loadStoredDegradationState,
} from "@/lib/denis/monitoring/degradation-state";
export type { StoredDegradationState } from "@/lib/denis/monitoring/degradation-state";
export {
  degradationDenisOffline,
  degradationForcesT0Only,
  degradationGuestOfflineMessage,
  degradationAllowsLlm,
  degradationOpsPatch,
  degradationReducesProactive,
  isDegradationFeatureDisabled,
  resolveDegradationLevel,
  resolveTargetDegradationLevel,
  stepDegradationLevel,
} from "@/lib/denis/config/degradation-ladder";
export { resolveDegradationFallbackTurn } from "@/lib/denis/config/degradation-fallback-intents";
export type {
  DegradationLevel,
  DegradationResolution,
} from "@/lib/denis/config/degradation-ladder";
