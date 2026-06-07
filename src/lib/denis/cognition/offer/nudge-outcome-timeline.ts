import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import {
  nudgeOutcomeDedupeKey,
  type NudgeOutcomeRecord,
} from "@/lib/denis/cognition/offer/nudge-outcome-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type AnticipationResolvedPayload = {
  type: "anticipation.resolved";
  nudgeId: string;
  nudgeKind: string;
  outcome: NudgeOutcomeRecord["outcome"];
  signal: NudgeOutcomeRecord["signal"];
  productId: string | null;
  productName: string | null;
  offerResolution: string | null;
  emittedAt: string;
  resolvedAt: string;
  lagMs: number | null;
};

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function extractLoggedNudgeOutcomeIds(
  timeline: DenisTimelineRow[]
): Set<string> {
  const ids = new Set<string>();
  for (const row of timeline) {
    if (row.event_type !== "anticipation.resolved") continue;
    const payload = asRecord(row.payload);
    if (payload.type !== "anticipation.resolved") continue;
    const nudgeId = payload.nudgeId;
    if (typeof nudgeId === "string" && nudgeId.trim()) {
      ids.add(nudgeId.trim());
    }
  }
  return ids;
}

/** Outcomes detected in fold but not yet persisted to timeline. */
export function findNewNudgeOutcomes(
  timeline: DenisTimelineRow[],
  nowMs = Date.now()
): NudgeOutcomeRecord[] {
  const logged = extractLoggedNudgeOutcomeIds(timeline);
  const { outcomes } = foldNudgeOutcomes(timeline, nowMs);

  return outcomes.filter(
    (outcome) => !logged.has(nudgeOutcomeDedupeKey(outcome))
  );
}

export function buildAnticipationResolvedPayload(
  outcome: NudgeOutcomeRecord
): AnticipationResolvedPayload {
  return {
    type: "anticipation.resolved",
    nudgeId: outcome.nudgeId,
    nudgeKind: outcome.nudgeKind,
    outcome: outcome.outcome,
    signal: outcome.signal,
    productId: outcome.productId,
    productName: outcome.productName,
    offerResolution: outcome.offerResolution,
    emittedAt: outcome.emittedAt,
    resolvedAt: outcome.resolvedAt,
    lagMs: outcome.lagMs,
  };
}
