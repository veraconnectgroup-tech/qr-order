import { manualSnapshotToDenisDraft } from "@/lib/denis/runtime/adapters/map-legacy-draft";
import { buildDenisTurnContext } from "@/lib/denis/runtime/build-turn-context";
import { mapLegacyIntentToGuest } from "@/lib/denis/runtime/map-legacy-intent";
import { persistDenisTurnTimeline } from "@/lib/denis/runtime/persist-turn-timeline";
export { recordChatTurnTimeline } from "@/lib/denis/runtime/record-chat-turn-timeline";
export type { RecordChatTurnTimelineInput } from "@/lib/denis/runtime/record-chat-turn-timeline";
export { runDenisTurn } from "@/lib/denis/runtime/run-denis-turn";
export { runDenisSense } from "@/lib/denis/runtime/run-denis-sense";
export type { DenisSenseResult } from "@/lib/denis/runtime/run-denis-sense";
export { processDenisSchedulerTick } from "@/lib/denis/runtime/process-scheduler-tick";
export {
  buildNarrationFacts,
  lintNarrationMessage,
  sanitizeNarrationOutput,
  templateNarrationFallback,
} from "@/lib/denis/runtime/narrate";
export type {
  NarrationFacts,
  SanitizedNarration,
} from "@/lib/denis/runtime/narrate";
export type {
  DenisChannel,
  DenisChatBody,
  DenisTurnContext,
  DenisTurnMeta,
  DenisTurnRunInput,
  ManualCartSnapshot,
} from "@/lib/denis/runtime/turn-types";
export {
  denisChatBodySchema,
  manualCartSnapshotSchema,
} from "@/lib/denis/runtime/turn-types";

/** Runtime PPAN+ layer — M7 runDenisTurn entry. */
export const DENIS_RUNTIME_LAYER = "runtime" as const;

export { manualSnapshotToDenisDraft, buildDenisTurnContext, mapLegacyIntentToGuest, persistDenisTurnTimeline };
