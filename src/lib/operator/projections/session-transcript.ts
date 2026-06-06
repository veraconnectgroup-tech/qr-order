import type { SupabaseClient } from "@supabase/supabase-js";
import { redactTranscript } from "@/lib/operator/projections/helpers";
import type { OperatorTranscript } from "@/lib/operator/types";

export async function projectOperatorSessionTranscript(
  admin: SupabaseClient,
  input: {
    orgId: string;
    sessionId: string;
    includePii?: boolean;
  }
): Promise<OperatorTranscript | null> {
  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("id, location_id, denis_shared_ai_session_id")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!sessionRow) return null;

  const session = sessionRow as {
    id: string;
    location_id: string;
    denis_shared_ai_session_id: string | null;
  };

  const { data: location } = await admin
    .from("locations")
    .select("id")
    .eq("id", session.location_id)
    .eq("org_id", input.orgId)
    .maybeSingle();

  if (!location) return null;

  let messages: Array<{ role: string; content: string }> = [];

  if (session.denis_shared_ai_session_id) {
    const { data: aiRow } = await admin
      .from("ai_sessions")
      .select("messages")
      .eq("id", session.denis_shared_ai_session_id)
      .eq("org_id", input.orgId)
      .maybeSingle();

    if (aiRow) {
      const ai = aiRow as {
        messages: Array<{ role: string; content: string }>;
      };
      messages = ai.messages ?? [];
    }
  }

  const turns = redactTranscript(messages);

  return {
    sessionId: session.id,
    locationId: session.location_id,
    turns,
    redacted: !input.includePii,
  };
}
