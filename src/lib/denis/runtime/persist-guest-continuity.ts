import { parseGuestFollowUpRequest } from "@/lib/denis/cognition/conversation/guest-continuity";
import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Persist explicit guest follow-up scheduling signal (C6). */
export async function persistGuestFollowUpRequest(
  admin: SupabaseClient,
  input: {
    aiSessionId: string;
    traceId: string;
    guestMessage: string;
    delaySeconds: number;
  }
): Promise<void> {
  await appendDenisTimelineEvent(admin, {
    aiSessionId: input.aiSessionId,
    eventType: "conversation.follow_up_requested",
    traceId: input.traceId,
    payload: {
      type: "conversation.follow_up_requested",
      guestMessage: input.guestMessage,
      delaySeconds: input.delaySeconds,
      at: new Date().toISOString(),
    },
  });
}

export function guestFollowUpFromMessage(
  message: string
): { delaySeconds: number } | null {
  return parseGuestFollowUpRequest(message);
}
