import { validateTableSession } from "@/lib/orders/validate-table-session";
import { getActiveTableSession } from "@/lib/sessions/session-devices";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WaiterCallContext = {
  tableId: string;
  locationId: string;
  tableName: string;
  sessionId: string | null;
};

/** Resolve table (+ optional session) for guest waiter call — QR always valid. */
export async function resolveWaiterCallContext(
  admin: SupabaseClient,
  input: {
    tableToken: string;
    sessionToken?: string | null;
  }
): Promise<
  { ok: true; data: WaiterCallContext } | { ok: false; error: string; status: number }
> {
  const { data: tableRow, error: tableError } = await admin
    .from("tables")
    .select("id, name, location_id, qr_token")
    .eq("qr_token", input.tableToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (tableError || !tableRow) {
    return { ok: false, error: "Invalid QR code", status: 404 };
  }

  const table = tableRow as {
    id: string;
    name: string;
    location_id: string;
    qr_token: string;
  };

  let sessionId: string | null = null;

  const token = input.sessionToken?.trim();
  if (token && token !== table.qr_token) {
    const validated = await validateTableSession(admin, table.qr_token, token);
    if (!("error" in validated)) {
      sessionId = validated.data.session.id;
    }
  }

  if (!sessionId) {
    const active = await getActiveTableSession(admin, table.id);
    sessionId = active?.id ?? null;
  }

  return {
    ok: true,
    data: {
      tableId: table.id,
      locationId: table.location_id,
      tableName: table.name,
      sessionId,
    },
  };
}
