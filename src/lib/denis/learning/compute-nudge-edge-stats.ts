import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type NudgeSessionTimelineInput = {
  anchorProductId: string | null;
  timeline: DenisTimelineRow[];
};

export type AggregatedNudgeEdgeStat = {
  fromProductId: string;
  toProductId: string;
  nudgeKind: string;
  impressions: number;
  accepts: number;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function edgeKey(fromProductId: string, toProductId: string, nudgeKind: string): string {
  return `${fromProductId}:${toProductId}:${nudgeKind}`;
}

/** Aggregate nudge impressions/accepts per anchor→product pair from session timelines (ADR-039 L2). */
export function aggregateNudgeEdgeStats(
  sessions: NudgeSessionTimelineInput[]
): AggregatedNudgeEdgeStat[] {
  const stats = new Map<string, AggregatedNudgeEdgeStat>();

  for (const session of sessions) {
    const anchor = session.anchorProductId?.trim();
    if (!anchor) continue;

    for (const row of session.timeline) {
      if (row.event_type !== "proactive.emitted") continue;
      const payload = asRecord(row.payload);
      const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
      const productId =
        typeof payload.productId === "string" && payload.productId.trim()
          ? payload.productId.trim()
          : null;
      if (!kind || !productId || productId === anchor) continue;

      const key = edgeKey(anchor, productId, kind);
      const entry = stats.get(key) ?? {
        fromProductId: anchor,
        toProductId: productId,
        nudgeKind: kind,
        impressions: 0,
        accepts: 0,
      };
      entry.impressions += 1;
      stats.set(key, entry);
    }

    const { outcomes } = foldNudgeOutcomes(session.timeline);
    for (const outcome of outcomes) {
      if (outcome.outcome !== "accepted") continue;
      if (!outcome.productId || outcome.productId === anchor) continue;

      const key = edgeKey(anchor, outcome.productId, outcome.nudgeKind);
      const entry = stats.get(key) ?? {
        fromProductId: anchor,
        toProductId: outcome.productId,
        nudgeKind: outcome.nudgeKind,
        impressions: 0,
        accepts: 0,
      };
      entry.accepts += 1;
      stats.set(key, entry);
    }
  }

  return [...stats.values()];
}
