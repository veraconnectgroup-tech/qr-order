import { resolveWaiterCallContext } from "@/lib/sessions/resolve-waiter-call-context";
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
    tableToken: string;
    sessionToken?: string | null;
  }
): Promise<ExecuteDenisWaiterHandoffResult> {
  const ctx = await resolveWaiterCallContext(admin, {
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
  });

  if (!ctx.ok) {
    return { ok: false, error: ctx.error };
  }

  if (
    ctx.data.tableId !== input.tableId ||
    ctx.data.locationId !== input.locationId
  ) {
    return { ok: false, error: "location_mismatch" };
  }

  const { tableId, tableName, locationId, sessionId } = ctx.data;

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
