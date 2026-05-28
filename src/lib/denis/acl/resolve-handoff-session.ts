import { SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import { validateTableSession } from "@/lib/orders/validate-table-session";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedHandoffSession = {
  tableToken: string;
  sessionToken: string;
  sessionId: string;
  tableId: string;
  tableName: string;
  locationId: string;
};

/** Resolve table + active session for Denis handoff ACL (QR or session token). */
export async function resolveHandoffSession(
  admin: SupabaseClient,
  input: {
    tableId: string;
    locationId: string;
    sessionToken: string;
  }
): Promise<
  { ok: true; data: ResolvedHandoffSession } | { ok: false; error: string }
> {
  const { data: tableRow, error: tableError } = await admin
    .from("tables")
    .select("id, name, location_id, qr_token")
    .eq("id", input.tableId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (tableError || !tableRow) {
    return { ok: false, error: "table_not_found" };
  }

  const table = tableRow as {
    id: string;
    name: string;
    location_id: string;
    qr_token: string;
  };

  if (table.location_id !== input.locationId) {
    return { ok: false, error: "location_mismatch" };
  }

  const tableToken = table.qr_token;

  if (input.sessionToken !== tableToken) {
    const validated = await validateTableSession(
      admin,
      tableToken,
      input.sessionToken
    );
    if ("error" in validated) {
      return { ok: false, error: validated.error };
    }

    return {
      ok: true,
      data: {
        tableToken,
        sessionToken: validated.data.session.session_token,
        sessionId: validated.data.session.id,
        tableId: table.id,
        tableName: validated.data.table.name,
        locationId: validated.data.session.location_id,
      },
    };
  }

  const maxAgeMs = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
  const sessionCutoff = new Date(Date.now() - maxAgeMs).toISOString();

  const { data: activeSession } = await admin
    .from("table_sessions")
    .select("id, session_token, location_id")
    .eq("table_id", input.tableId)
    .eq("status", "active")
    .gte("opened_at", sessionCutoff)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeSession) {
    return { ok: false, error: "no_active_session" };
  }

  const session = activeSession as {
    id: string;
    session_token: string;
    location_id: string;
  };

  return {
    ok: true,
    data: {
      tableToken,
      sessionToken: session.session_token,
      sessionId: session.id,
      tableId: table.id,
      tableName: table.name,
      locationId: session.location_id,
    },
  };
}
