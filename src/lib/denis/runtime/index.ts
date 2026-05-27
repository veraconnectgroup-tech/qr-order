import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { foldMinimalBeliefs } from "@/lib/denis/kernel/fold-beliefs";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function replaySessionBeliefs(
  admin: SupabaseClient,
  aiSessionId: string
) {
  const events = await loadDenisTimeline(admin, aiSessionId);
  return foldMinimalBeliefs(events);
}

export { recordChatTurnTimeline } from "@/lib/denis/runtime/record-chat-turn-timeline";
export type { RecordChatTurnTimelineInput } from "@/lib/denis/runtime/record-chat-turn-timeline";

/** Runtime PPAN+ layer marker — M7 full entry; M2 dual-write bridge. */
export const DENIS_RUNTIME_LAYER = "runtime" as const;
