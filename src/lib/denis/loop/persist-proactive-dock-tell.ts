import type { ProactiveNudgeKind } from "@/lib/denis/loop/proactive-dock-tell";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { createTurnTraceId } from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** TELL commit for dock-visible proactive nudges (ADR-019 D-PRO → PROJECT). */
export async function persistProactiveDockTell(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId?: string;
    kind: ProactiveNudgeKind;
    message: string;
    orderId?: string;
  }
): Promise<void> {
  const traceId = input.traceId ?? createTurnTraceId();

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "tell.committed",
    traceId,
    payload: {
      type: "tell.committed",
      message: input.message,
      tier: "template",
      source: "sense.proactive_dock",
      linted: true,
    },
  });

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "narration.sent",
    traceId,
    payload: {
      type: "narration.sent",
      message: input.message,
      tier: "template",
      linted: true,
      source: "sense.proactive_dock",
    },
  });
}
