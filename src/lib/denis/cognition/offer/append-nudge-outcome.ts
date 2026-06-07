import {
  buildAnticipationResolvedPayload,
  findNewNudgeOutcomes,
} from "@/lib/denis/cognition/offer/nudge-outcome-timeline";
import type { NudgeOutcomeRecord } from "@/lib/denis/cognition/offer/nudge-outcome-types";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Append anticipation.resolved for newly terminal nudges (ADR-039 L1). */
export async function maybeAppendNudgeOutcomes(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    timeline: DenisTimelineRow[];
    contextHash?: string | null;
    nowMs?: number;
  }
): Promise<NudgeOutcomeRecord[]> {
  const fresh = findNewNudgeOutcomes(input.timeline, input.nowMs);
  if (fresh.length === 0) return [];

  for (const outcome of fresh) {
    await appendDenisTimelineEvent(admin, {
      aiSessionId: input.aiSessionId,
      eventType: "anticipation.resolved",
      traceId: input.traceId,
      contextHash: input.contextHash ?? null,
      payload: buildAnticipationResolvedPayload(outcome),
    });
  }

  return fresh;
}
