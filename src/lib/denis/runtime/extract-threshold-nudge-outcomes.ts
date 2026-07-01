import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import { buildNudgeId } from "@/lib/denis/platform/nudge-outcome-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { ThresholdNudgeOutcome } from "@/lib/denis/platform/threshold-optimizer-types";

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readTimingMinutes(payload: Record<string, unknown>): number | null {
  const direct = payload.timingMinutes;
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const idleSec = payload.idleSinceBrowseSec;
  if (typeof idleSec === "number" && Number.isFinite(idleSec) && idleSec > 0) {
    return idleSec / 60;
  }
  return null;
}

/** Build threshold optimizer rows from session timelines (M3). */
export function extractThresholdNudgeOutcomes(
  timelines: DenisTimelineRow[][]
): ThresholdNudgeOutcome[] {
  const rows: ThresholdNudgeOutcome[] = [];

  for (const timeline of timelines) {
    const { outcomes } = foldNudgeOutcomes(timeline);
    const timingByNudgeId = new Map<string, number>();

    for (const row of timeline) {
      if (row.event_type !== "proactive.emitted") continue;
      const payload = asRecord(row.payload);
      const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
      if (!kind) continue;
      const timing = readTimingMinutes(payload);
      if (timing == null) continue;

      const productId =
        typeof payload.productId === "string" && payload.productId.trim()
          ? payload.productId.trim()
          : null;
      const nudgeId = buildNudgeId({
        kind,
        productId,
        emittedAt: row.created_at,
        dedupeKey:
          typeof payload.dedupeKey === "string" ? payload.dedupeKey : null,
      });
      timingByNudgeId.set(nudgeId, timing);
    }

    for (const outcome of outcomes) {
      const timingMinutes = timingByNudgeId.get(outcome.nudgeId);
      if (timingMinutes == null) continue;
      rows.push({
        nudgeKind: outcome.nudgeKind,
        outcome: outcome.outcome,
        timingMinutes,
      });
    }
  }

  return rows;
}
