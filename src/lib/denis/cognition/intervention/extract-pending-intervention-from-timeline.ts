import type { MentalModelGatePayload } from "@/lib/denis/cognition/mental-model/mental-model-timeline";
import type { InterventionDecision } from "@/lib/denis/cognition/intervention/intervention-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type PendingInterventionFromTimeline = {
  interventionId: string;
  traceId: string;
  decision: InterventionDecision;
  ruleId: string | null;
  deferredAtMs: number;
};

function isGatePayload(
  payload: DenisTimelineRow["payload"]
): payload is MentalModelGatePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    (payload as { type?: string }).type === "mental_model.gate"
  );
}

/** Last pending IJS defer from mental_model.gate rows (ADR-041 P5). */
export function extractPendingInterventionFromTimeline(
  timeline: DenisTimelineRow[]
): PendingInterventionFromTimeline | null {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const row = timeline[i]!;
    if (row.event_type !== "mental_model.gate") continue;
    if (!isGatePayload(row.payload)) continue;

    const ijs = row.payload.ijs;
    if (!ijs || ijs.decision !== "defer") continue;
    if (!row.trace_id) continue;

    const deferredAtMs = Date.parse(row.created_at);
    if (!Number.isFinite(deferredAtMs)) continue;

    return {
      interventionId: `${row.trace_id}:ijs`,
      traceId: row.trace_id,
      decision: "defer",
      ruleId: ijs.ruleId,
      deferredAtMs,
    };
  }

  return null;
}
