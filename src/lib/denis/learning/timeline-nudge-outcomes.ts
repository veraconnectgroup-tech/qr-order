import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type TimelineNudgeAccept = {
  productId: string;
  productName: string | null;
  nudgeKind: string;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Read accepted nudge outcomes from timeline (learning layer — no cognition import). */
export function readAcceptedNudgeOutcomes(
  timeline: DenisTimelineRow[]
): TimelineNudgeAccept[] {
  const accepts: TimelineNudgeAccept[] = [];

  for (const row of timeline) {
    if (row.event_type !== "anticipation.resolved") continue;
    const payload = asRecord(row.payload);
    if (payload.type !== "anticipation.resolved") continue;
    if (payload.outcome !== "accepted") continue;

    const productId =
      typeof payload.productId === "string" && payload.productId.trim()
        ? payload.productId.trim()
        : null;
    if (!productId) continue;

    accepts.push({
      productId,
      productName:
        typeof payload.productName === "string" ? payload.productName : null,
      nudgeKind:
        typeof payload.nudgeKind === "string" ? payload.nudgeKind.trim() : "",
    });
  }

  return accepts;
}
