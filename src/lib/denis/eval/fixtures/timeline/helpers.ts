import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const SESSION = "sess-iota-fixture";
const AI_SESSION = "ai-iota-fixture";

export function timelineRow(input: {
  seq: number;
  eventType: DenisTimelineRow["event_type"];
  traceId: string;
  payload: DenisTimelineRow["payload"];
  createdAt?: string;
}): DenisTimelineRow {
  return {
    id: `tl-${input.seq}`,
    ai_session_id: AI_SESSION,
    seq: input.seq,
    event_type: input.eventType,
    payload: input.payload,
    trace_id: input.traceId,
    context_hash: null,
    created_at: input.createdAt ?? `2026-05-29T12:00:${String(input.seq).padStart(2, "0")}.000Z`,
  };
}

export const IOTA_FIXTURE_SESSION = SESSION;
export const IOTA_FIXTURE_AI_SESSION = AI_SESSION;
