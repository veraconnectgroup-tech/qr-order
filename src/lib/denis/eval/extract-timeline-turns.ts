import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";

export type TimelineReplayTurn = {
  traceId: string;
  firstSeq: number;
  guestText: string;
  flowNodeId: FlowNodeId;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Ordered guest turns from append-only timeline (for venue sim replay). */
export function extractTimelineReplayTurns(
  events: DenisTimelineRow[]
): TimelineReplayTurn[] {
  const byTrace = new Map<
    string,
    {
      firstSeq: number;
      guestText: string | null;
      flowFrom: FlowNodeId | null;
    }
  >();

  for (const event of events) {
    const traceId = event.trace_id?.trim();
    if (!traceId) continue;

    let row = byTrace.get(traceId);
    if (!row) {
      row = { firstSeq: event.seq, guestText: null, flowFrom: null };
      byTrace.set(traceId, row);
    }

    if (event.seq < row.firstSeq) {
      row.firstSeq = event.seq;
    }

    const payload = asRecord(event.payload);

    if (event.event_type === "perception.ingested") {
      const frame = payload.frame as Record<string, unknown> | undefined;
      const text =
        typeof frame?.normalizedText === "string" ? frame.normalizedText : null;
      if (text) row.guestText = text;
    }

    if (event.event_type === "flow.transitioned") {
      if (typeof payload.from === "string") {
        row.flowFrom = payload.from as FlowNodeId;
      }
    }
  }

  return [...byTrace.entries()]
    .filter(([, row]) => row.guestText)
    .sort((a, b) => a[1].firstSeq - b[1].firstSeq)
    .map(([traceId, row]) => ({
      traceId,
      firstSeq: row.firstSeq,
      guestText: row.guestText!,
      flowNodeId: row.flowFrom ?? "welcome",
    }));
}
