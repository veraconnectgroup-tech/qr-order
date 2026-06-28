/** L2 Kernel — beliefs, goals, planner, T0 reflex (M2–M4). */
export {
  emptyMinimalBeliefs,
  foldMinimalBeliefs,
  replayMinimalBeliefs,
} from "@/lib/denis/kernel/fold-beliefs";
export type {
  Belief,
  BeliefSource,
  DenisMinimalBeliefs,
} from "@/lib/denis/kernel/fold-beliefs";
export {
  bumpCartRevision,
  cartLinesForSignals,
  cloneCartDraft,
  emptyCartDraft,
  emptyCartState,
  MAX_CART_UNDO_DEPTH,
} from "@/lib/denis/kernel/cart-projection";
export type {
  CartLineDiff,
  CartUndoEntry,
  DenisCartDraft,
  DenisCartLine,
  DenisCartState,
} from "@/lib/denis/kernel/cart-projection";
export { analyzeCartSnapshot } from "@/lib/denis/kernel/cart-signals";
export type { CartLineSnapshot, CartSnapshot } from "@/lib/denis/kernel/cart-signals";
export {
  applyCorrectionCommand,
  undoLastCartChange,
} from "@/lib/denis/kernel/correction-protocol";
export type { CorrectionOutcome } from "@/lib/denis/kernel/correction-protocol";
export { deriveGoalStack, topGoal } from "@/lib/denis/kernel/goal-stack";
export { buildSessionDebugGraph } from "@/lib/denis/kernel/session-debug-graph";
export type {
  DenisSessionDebugGraph,
  DebugBeliefRow,
  DebugTurnSummary,
} from "@/lib/denis/kernel/session-debug-graph";
export type {
  DenisGoal,
  GoalDerivationContext,
  GoalStack,
  PendingSlot,
  UpsellCategory,
} from "@/lib/denis/kernel/goal-types";
export { planTurn } from "@/lib/denis/kernel/plan-turn";
export type { PlanTurnInput, PlanTurnResult, PlannedSkill } from "@/lib/denis/kernel/plan-turn";
export { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
export type { ReflexTurnInput, ReflexTurnResult } from "@/lib/denis/kernel/reflex-plan";
export {
  isT0Confirm,
  isT0Decline,
  isT0Done,
  resolveT0Reflex,
} from "@/lib/denis/kernel/reflex-rules";
export type {
  CorrectionCommand,
  ReflexRuleId,
  T0ReflexResult,
} from "@/lib/denis/kernel/reflex-rules";
export {
  SKILL_REGISTRY,
  resolveSkill,
  skillsForNode,
} from "@/lib/denis/kernel/skill-registry";
export type { DenisSkillId, SkillDefinition } from "@/lib/denis/kernel/skill-registry";

export {
  allergySafeMenuProductIds,
  buildVenueKnowledgeGraph,
  explainPopularProducts,
  explainProduct,
  invalidateVenueKnowledgeGraphCache,
  loadVenueKnowledgeGraph,
  matchProductsInMessage,
  pairingFor,
  pairingForSafe,
  safeForAllergies,
  substituteFor,
  substitutesForUnavailable,
} from "@/lib/denis/kernel/vkg";
export type {
  VenueKnowledgeGraph,
  VkgPairingSuggestion,
  VkgProductExplain,
  VkgSubstituteSuggestion,
  VkgUnavailableSubstitute,
} from "@/lib/denis/kernel/vkg";

export {
  buildProposedMerge,
  detectCartConflicts,
  hasCartConflicts,
  resolveCartConflict,
} from "@/lib/denis/kernel/conflict";
export type {
  CartConflict,
  ConflictResolution,
  ResolutionStrategy,
  UnifiedCartView,
} from "@/lib/denis/kernel/conflict";

export {
  buildScheduleDrafts,
  claimDueDenisSchedules,
  upsertDenisSchedules,
} from "@/lib/denis/kernel/scheduler";
export type {
  ProactiveEvaluation,
  ScheduledIntentDraft,
  ScheduleTickResult,
} from "@/lib/denis/kernel/scheduler";

export const DENIS_KERNEL_LAYER = "kernel" as const;
