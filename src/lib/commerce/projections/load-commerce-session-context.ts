import type { SupabaseClient } from "@supabase/supabase-js";

export type CommerceSessionContext = {
  orgId: string;
  locationId: string;
  sessionId: string;
};

/** Resolve table session + org from Denis ai_session (GMM-13 bridge). */
export async function loadCommerceSessionContextForAiSession(
  admin: SupabaseClient,
  aiSessionId: string
): Promise<CommerceSessionContext | null> {
  const { data: aiSession } = await admin
    .from("ai_sessions")
    .select("table_id, session_token")
    .eq("id", aiSessionId)
    .maybeSingle();

  if (!aiSession) return null;

  const row = aiSession as { table_id: string; session_token: string };

  const { data: tableSession } = await admin
    .from("table_sessions")
    .select("id, location_id")
    .eq("session_token", row.session_token)
    .eq("table_id", row.table_id)
    .eq("status", "active")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tableSession) return null;

  const sessionRow = tableSession as { id: string; location_id: string };

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", sessionRow.location_id)
    .maybeSingle();

  if (!location) return null;

  return {
    orgId: (location as { org_id: string }).org_id,
    locationId: sessionRow.location_id,
    sessionId: sessionRow.id,
  };
}

export async function loadCommerceSessionContext(
  admin: SupabaseClient,
  input: { aiSessionId?: string; tableSessionId?: string }
): Promise<CommerceSessionContext | null> {
  if (input.tableSessionId) {
    const { data: session } = await admin
      .from("table_sessions")
      .select("id, location_id")
      .eq("id", input.tableSessionId)
      .maybeSingle();

    if (!session) return null;

    const sessionRow = session as { id: string; location_id: string };

    const { data: location } = await admin
      .from("locations")
      .select("org_id")
      .eq("id", sessionRow.location_id)
      .maybeSingle();

    if (!location) return null;

    return {
      orgId: (location as { org_id: string }).org_id,
      locationId: sessionRow.location_id,
      sessionId: sessionRow.id,
    };
  }

  if (input.aiSessionId) {
    return loadCommerceSessionContextForAiSession(admin, input.aiSessionId);
  }

  return null;
}
