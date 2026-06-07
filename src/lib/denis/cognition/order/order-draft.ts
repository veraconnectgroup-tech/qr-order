/** ADR-034-A — cognition facade over legacy draft engine (runtime must not import lib/ai/ordering). */
export {
  initDraftFromStorage,
  tryResolveQuickReply,
} from "@/lib/ai/ordering/draft-engine";
export type {
  AiOrderDraft,
  ValidatedCartAction,
} from "@/lib/ai/ordering/draft-types";
