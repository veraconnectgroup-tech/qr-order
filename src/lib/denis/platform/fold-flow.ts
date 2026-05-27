import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { FlowNodeId } from "@/lib/denis/platform/flow-types";

export type FlowProjection = {
  currentNodeId: FlowNodeId;
  previousNodeId: FlowNodeId | null;
  lastSignal: string | null;
  transitionCount: number;
};

export function emptyFlowProjection(entryNodeId: FlowNodeId): FlowProjection {
  return {
    currentNodeId: entryNodeId,
    previousNodeId: null,
    lastSignal: null,
    transitionCount: 0,
  };
}

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Fold flow.transitioned events — default entry is welcome. */
export function foldFlowProjection(
  events: DenisTimelineRow[],
  entryNodeId: FlowNodeId = "welcome"
): FlowProjection {
  let state = emptyFlowProjection(entryNodeId);

  for (const event of events) {
    if (event.event_type !== "flow.transitioned") continue;
    const payload = asRecord(event.payload);
    const to =
      typeof payload.to === "string" ? payload.to : state.currentNodeId;
    const from =
      typeof payload.from === "string" ? payload.from : state.currentNodeId;
    const signal =
      typeof payload.signal === "string" ? payload.signal : null;

    state = {
      currentNodeId: to,
      previousNodeId: from,
      lastSignal: signal,
      transitionCount: state.transitionCount + 1,
    };
  }

  return state;
}
