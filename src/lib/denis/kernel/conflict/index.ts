export type {
  CartConflict,
  ConflictResolution,
  ResolutionStrategy,
  UnifiedCartView,
} from "@/lib/denis/kernel/conflict/types";
export {
  detectCartConflicts,
  hasCartConflicts,
} from "@/lib/denis/kernel/conflict/detect";
export {
  lineFingerprint,
  linesEqual,
  unitPrice,
} from "@/lib/denis/kernel/conflict/line-match";
export {
  buildConflictGuestPrompt,
  buildConflictSummary,
} from "@/lib/denis/kernel/conflict/prompts";
export {
  buildProposedMerge,
  resolveCartConflict,
  type ResolveCartConflictInput,
} from "@/lib/denis/kernel/conflict/resolve";
export {
  buildPeerAddedPrompt,
  combineManualDrafts,
} from "@/lib/denis/kernel/conflict/peer-manual";
