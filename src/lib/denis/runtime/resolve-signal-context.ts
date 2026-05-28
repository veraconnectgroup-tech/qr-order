import { resolveGuestAiContextToken } from "@/lib/ai/guest-ai-token";
import type { DenisSignalRequest } from "@/lib/denis/ingress/signal-types";
import { resolveWaiterCallContext } from "@/lib/sessions/resolve-waiter-call-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedSignalContext = {
  tableId: string;
  locationId: string;
  tableToken: string;
  tableName: string;
  tableSessionId: string | null;
  guestSessionToken: string | null;
  aiContextToken: string;
  language: string;
};

export async function resolveSignalContext(
  admin: SupabaseClient,
  request: DenisSignalRequest
): Promise<
  { ok: true; ctx: ResolvedSignalContext } | { ok: false; error: string; status: number }
> {
  const tableCtx = await resolveWaiterCallContext(admin, {
    tableToken: request.tableToken,
    sessionToken: request.tableSessionToken ?? request.sessionToken,
  });

  if (!tableCtx.ok) {
    return { ok: false, error: tableCtx.error, status: tableCtx.status };
  }

  const guestSessionToken =
    request.tableSessionToken ?? request.sessionToken ?? null;
  const aiContextToken = resolveGuestAiContextToken(
    request.tableToken,
    guestSessionToken
  );

  if (!aiContextToken) {
    return { ok: false, error: "Unauthorized.", status: 401 };
  }

  return {
    ok: true,
    ctx: {
      tableId: request.tableId ?? tableCtx.data.tableId,
      locationId: request.locationId ?? tableCtx.data.locationId,
      tableToken: request.tableToken,
      tableName: tableCtx.data.tableName,
      tableSessionId: tableCtx.data.sessionId,
      guestSessionToken,
      aiContextToken,
      language: request.language ?? "de",
    },
  };
}
