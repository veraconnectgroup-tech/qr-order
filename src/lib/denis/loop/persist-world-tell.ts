import type { CommerceWorldSignalKind } from "@/lib/denis/loop/tell-world-order";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import {
  buildTurnEnvelope,
  createTurnTraceId,
} from "@/lib/denis/platform/timeline-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistWorldTell(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId?: string;
    signal: CommerceWorldSignalKind;
    orderId: string;
    orderNumber: number;
    status: string;
    message: string;
  }
): Promise<void> {
  const traceId = input.traceId ?? createTurnTraceId();
  const envelope = buildTurnEnvelope("system", traceId);

  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "world.ingested",
    traceId,
    payload: {
      type: "world.ingested",
      signal: input.signal,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      status: input.status,
      envelope,
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
      source: "world.commerce",
    },
  });
}
