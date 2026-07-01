export {
  aggregateLocationLearnings,
  type LocationLearningsAggregate,
  type MenuGapLearningAggregate,
} from "@/lib/denis/learning/aggregate-location-learnings";
export {
  accumulateVenueKnowledge,
  mergeRhythmPriorsIntoVenueKnowledge,
  resolvePeakBehaviorFromVenueKnowledge,
  resolveVenueKnowledgeAutoPair,
  AUTO_PAIR_MIN_RATE_PCT,
  AUTO_PAIR_MIN_SESSIONS,
} from "@/lib/denis/learning/venue-knowledge-accumulator";
export {
  applyRetentionPolicyToSnapshot,
  classifyRetentionTier,
  partitionOrderRowsByRetention,
  VENUE_KNOWLEDGE_AGGREGATED_DAYS,
  VENUE_KNOWLEDGE_FULL_DETAIL_DAYS,
} from "@/lib/denis/learning/venue-knowledge-retention";
export {
  attachVenueKnowledgeToPriors,
  parseVenueKnowledgeFromPriors,
  type LocationRhythmPriorsWithKnowledge,
} from "@/lib/denis/learning/venue-knowledge-storage";
export {
  fetchVenueKnowledgeOrderRows,
  loadVenueKnowledgeForLocation,
  rollupVenueKnowledgeForLocation,
} from "@/lib/denis/learning/rollup-venue-knowledge";
export type {
  VenueKnowledgeAccumulateInput,
  VenueKnowledgeOrderRow,
} from "@/lib/denis/learning/venue-knowledge-types";
export type {
  VenueKnowledgeJson,
  VenueKnowledgeSnapshot,
} from "@/lib/denis/platform/venue-knowledge-types";
export {
  detectTurnLearningSignals,
  isChatLikeTurnIntent,
  type DetectTurnLearningSignalsInput,
  type TurnLearningSignal,
} from "@/lib/denis/platform/detect-turn-learning-signals";
export { emitTurnLearningEvents } from "@/lib/denis/platform/emit-turn-learning-events";
export type {
  AggregatedPairStat,
  LearnedEdgeCandidate,
  LearnedEdgeStatus,
  LearnedEdgeType,
  SessionPairInput,
} from "@/lib/denis/learning/types";
export {
  acceptRate,
  aggregateSessionPairStats,
  meetsLearnedEdgeThreshold,
  suggestedWeightFromAcceptRate,
} from "@/lib/denis/learning/compute-pair-stats";
export {
  aggregateNudgeEdgeStats,
  type AggregatedNudgeEdgeStat,
  type NudgeSessionTimelineInput,
} from "@/lib/denis/learning/compute-nudge-edge-stats";
export {
  aggregateProductNudgeStatsFromTimelines,
  type ProductNudgePerformance,
} from "@/lib/denis/learning/aggregate-product-nudge-stats";
export type {
  GuestMemoryConsent,
  GuestMemoryProjection,
  GuestMemoryScope,
  GuestMemorySyncPayload,
} from "@/lib/denis/platform/guest-memory-types";
export { buildReturnGuestWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-welcome-message";
export { buildRelationshipWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-relationship-welcome";
export {
  appendRelationshipVisit,
  computeBehavioralPatterns,
  emptyGuestRelationshipSnapshot,
  parseGuestRelationshipSnapshot,
  refreshRelationshipSnapshot,
} from "@/lib/denis/learning/guest-memory/build-relationship-timeline";
export {
  detectGuestOccasions,
  formatOccasionHintLine,
} from "@/lib/denis/learning/guest-memory/detect-guest-occasions";
export {
  detectPreferenceEvolution,
  formatPreferenceEvolutionHint,
  preferenceEvolutionChanged,
} from "@/lib/denis/learning/guest-memory/detect-preference-evolution";
export {
  buildProductFeedbackKnowledge,
  feedbackPolicyForProduct,
  type ProductFeedbackKnowledge,
} from "@/lib/denis/learning/feedback-dish-knowledge";
export { sameAgainQuickReplyLabels } from "@/lib/denis/learning/guest-memory/same-again-chips";
export {
  applyTypoCorrectionToQuery,
  buildTypoCorrectionMap,
  learnTypoCorrection,
  lookupLearnedTypoCorrection,
  recordTypoCorrectionFromGuestConfirm,
  type TypoCorrectionEntry,
  type TypoCorrectionMap,
} from "@/lib/denis/learning/typo-corrections";
