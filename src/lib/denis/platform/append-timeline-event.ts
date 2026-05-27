import type {
  AppendTimelineEventInput,
  DenisTimelineRow,
} from "@/lib/denis/platform/timeline-types";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type AppendRpcRow = {
  id: string;
  ai_session_id: string;
  seq: number;
  event_type: string;
  payload: Record<string, unknown>;
  trace_id: string | null;
  context_hash: string | null;
  created_at: string;
};

function toTimelineRow(row: AppendRpcRow): DenisTimelineRow {
  return {
    id: row.id,
    ai_session_id: row.ai_session_id,
    seq: Number(row.seq),
    event_type: row.event_type,
    payload: row.payload as DenisTimelineRow["payload"],
    trace_id: row.trace_id,
    context_hash: row.context_hash,
    created_at: row.created_at,
  };
}

export async function appendDenisTimelineEvent(
  admin: SupabaseClient,
  input: AppendTimelineEventInput
): Promise<DenisTimelineRow | null> {
  const { data, error } = await admin.rpc("append_denis_timeline_event", {
    p_ai_session_id: input.aiSessionId,
    p_event_type: input.eventType,
    p_payload: input.payload as Record<string, unknown>,
    p_trace_id: input.traceId ?? null,
    p_context_hash: input.contextHash ?? null,
  });

  if (error) {
    logger.error("append_denis_timeline_event failed", {
      aiSessionId: input.aiSessionId,
      eventType: input.eventType,
      error: error.message,
    });
    return null;
  }

  const row = data as AppendRpcRow | null;
  if (!row) return null;
  return toTimelineRow(row);
}

export async function loadDenisTimeline(
  admin: SupabaseClient,
  aiSessionId: string
): Promise<DenisTimelineRow[]> {
  const { data, error } = await admin
    .from("denis_timeline")
    .select(
      "id, ai_session_id, seq, event_type, payload, trace_id, context_hash, created_at"
    )
    .eq("ai_session_id", aiSessionId)
    .order("seq", { ascending: true });

  if (error) {
    logger.error("loadDenisTimeline failed", {
      aiSessionId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []).map((row) =>
    toTimelineRow(row as AppendRpcRow)
  );
}
