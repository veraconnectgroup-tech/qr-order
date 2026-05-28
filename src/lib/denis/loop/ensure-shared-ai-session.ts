import { appendDenisTimelineEvent } from "@/lib/denis/platform/append-timeline-event";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

type EnsureSharedAiSessionInput = {
  sessionId: string;
  locationId: string;
  tableId: string;
  tableToken: string;
  orgId: string;
  language?: string;
};

/** Resolve or bootstrap shared ai_session for table session world events (Phase D). */
export async function ensureSharedAiSessionForTableSession(
  admin: SupabaseClient,
  input: EnsureSharedAiSessionInput
): Promise<string | null> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("denis_shared_ai_session_id, session_token")
    .eq("id", input.sessionId)
    .maybeSingle();

  const session = sessionRow as {
    denis_shared_ai_session_id: string | null;
    session_token: string;
  } | null;

  if (!session) return null;

  if (session.denis_shared_ai_session_id) {
    return session.denis_shared_ai_session_id;
  }

  const { data: partyDevice } = await admin
    .from("denis_party_devices")
    .select("ai_session_id")
    .eq("table_session_id", input.sessionId)
    .not("ai_session_id", "is", null)
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const partyAiSessionId = (partyDevice as { ai_session_id: string } | null)
    ?.ai_session_id;

  if (partyAiSessionId) {
    await admin
      .from("table_sessions")
      .update({ denis_shared_ai_session_id: partyAiSessionId })
      .eq("id", input.sessionId);
    return partyAiSessionId;
  }

  const { data: inserted, error: insertError } = await admin
    .from("ai_sessions")
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      table_id: input.tableId,
      session_token: session.session_token,
      language: input.language ?? "de",
      guest_preferences: { allergies: [], mood: "" },
      messages: [],
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    logger.warn("ensureSharedAiSession insert failed", {
      sessionId: input.sessionId,
      error: insertError?.message,
    });
    return null;
  }

  const aiSessionId = (inserted as { id: string }).id;

  await admin
    .from("table_sessions")
    .update({ denis_shared_ai_session_id: aiSessionId })
    .eq("id", input.sessionId);

  return aiSessionId;
}
