import { resolveHandoffSession } from "@/lib/denis/acl/resolve-handoff-session";
import { scheduleWaiterCallPush } from "@/lib/push/schedule-notify";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecuteDenisWaiterHandoffResult =
  | { ok: true; tableName: string }
  | { ok: false; error: string };

/** M23 ACL — same side effect as POST /api/waiter-calls. */
export async function executeDenisWaiterHandoff(
  admin: SupabaseClient,
  input: {
    tableId: string;
    locationId: string;
    sessionToken: string;
  }
): Promise<ExecuteDenisWaiterHandoffResult> {
  const resolved = await resolveHandoffSession(admin, input);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const { sessionId, tableId, tableName, locationId } = resolved.data;

  const { error } = await admin.from("waiter_calls").insert({
    table_id: tableId,
    location_id: locationId,
    session_id: sessionId,
  });

  if (error) {
    return { ok: false, error: "waiter_call_failed" };
  }

  scheduleWaiterCallPush(locationId, tableName);

  return { ok: true, tableName };
}
