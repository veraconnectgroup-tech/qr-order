import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { FoldMeta } from "@/lib/denis/loop/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function appendMindFoldCompleted(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    meta: FoldMeta;
  }
): Promise<void> {
  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "mind.fold_completed",
    traceId: input.traceId,
    contextHash: input.meta.truthHash,
    payload: {
      type: "mind.fold_completed",
      truthHash: input.meta.truthHash,
      orderCount: input.meta.orderCount,
      phase: input.meta.phase,
      tableSessionId: input.meta.tableSessionId,
    },
  });
}
