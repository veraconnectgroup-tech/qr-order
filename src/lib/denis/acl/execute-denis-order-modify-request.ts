import { executeDenisGuestOrderCancel } from "@/lib/denis/acl/execute-denis-guest-order-cancel";
import { executeDenisWaiterHandoff } from "@/lib/denis/acl/execute-denis-waiter-handoff";
import { resolveHandoffSession } from "@/lib/denis/acl/resolve-handoff-session";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecuteDenisOrderModifyRequestResult =
  | { ok: true; kind: "cancelled_reorder"; orderNumber: number }
  | { ok: true; kind: "staff_escalation"; orderNumber: number | null }
  | { ok: false; error: string };

/** M23 ACL — pending: cancel so guest can reorder; otherwise staff handoff. */
export async function executeDenisOrderModifyRequest(
  admin: SupabaseClient,
  input: {
    tableId: string;
    locationId: string;
    tableToken: string;
    sessionToken: string;
  }
): Promise<ExecuteDenisOrderModifyRequestResult> {
  const cancelAttempt = await executeDenisGuestOrderCancel(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    sessionToken: input.sessionToken,
  });

  if (!cancelAttempt.ok) {
    return cancelAttempt;
  }

  if (cancelAttempt.kind === "cancelled") {
    return {
      ok: true,
      kind: "cancelled_reorder",
      orderNumber: cancelAttempt.orderNumber,
    };
  }

  const resolved = await resolveHandoffSession(admin, input);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const waiter = await executeDenisWaiterHandoff(admin, {
    tableId: input.tableId,
    locationId: input.locationId,
    tableToken: input.tableToken,
    sessionToken: input.sessionToken,
  });

  if (!waiter.ok) {
    return { ok: false, error: waiter.error };
  }

  return {
    ok: true,
    kind: "staff_escalation",
    orderNumber: cancelAttempt.orderNumber,
  };
}
