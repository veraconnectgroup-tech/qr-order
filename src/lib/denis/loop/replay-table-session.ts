import { loadOrderFactsForSession } from "@/lib/denis/loop/load-order-facts";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { OrderFact } from "@/lib/denis/loop/types";
import type { TranscriptEntry } from "@/lib/denis/loop/view-types";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TableSessionReplay = {
  sessionId: string;
  aiSessionId: string;
  timeline: DenisTimelineRow[];
  orders: OrderFact[];
  transcript: TranscriptEntry[];
};

/**
 * ADR-019 Phase F — dispute replay from TRUTH only (timeline + orders).
 * Does not read ai_sessions.messages.
 */
export async function replayTableSessionTruth(
  admin: SupabaseClient,
  input: {
    tableSessionId: string;
    aiSessionId: string;
  }
): Promise<TableSessionReplay> {
  const [timeline, orders] = await Promise.all([
    loadDenisTimeline(admin, input.aiSessionId),
    loadOrderFactsForSession(admin, input.tableSessionId),
  ]);

  return {
    sessionId: input.tableSessionId,
    aiSessionId: input.aiSessionId,
    timeline,
    orders,
    transcript: foldTranscriptFromTimeline(timeline),
  };
}
