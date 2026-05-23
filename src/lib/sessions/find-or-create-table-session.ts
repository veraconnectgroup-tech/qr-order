import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function findOrCreateTableSession(
  admin: AdminClient,
  tableId: string,
  locationId: string
): Promise<
  | { sessionId: string; sessionToken: string }
  | { error: string; status: number }
> {
  const maxAge = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - maxAge).toISOString();

  const { data: existing } = await admin
    .from("table_sessions")
    .select("id, session_token")
    .eq("table_id", tableId)
    .eq("status", "active")
    .gte("opened_at", cutoff)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; session_token: string };
    return { sessionId: row.id, sessionToken: row.session_token };
  }

  await admin
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("table_id", tableId)
    .eq("status", "active");

  const { data: session, error } = await admin
    .from("table_sessions")
    .insert({
      table_id: tableId,
      location_id: locationId,
    })
    .select("id, session_token")
    .single();

  if (error || !session) {
    return { error: "Session could not be created.", status: 500 };
  }

  const sessionRow = session as { id: string; session_token: string };
  return {
    sessionId: sessionRow.id,
    sessionToken: sessionRow.session_token,
  };
}
