import { verifyAiGuestContext } from "@/lib/ai/verify-guest-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiTurnOrgContext = {
  orgId: string;
  orgName: string;
};

/** Resolve org for a guest AI turn (shared by metering + legacy adapter). */
export async function resolveAiTurnOrg(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    sessionToken: string;
  }
): Promise<{ ok: true; data: AiTurnOrgContext } | { ok: false; error: string; status: number }> {
  const guestContext = await verifyAiGuestContext(admin, input);
  if ("error" in guestContext) {
    return { ok: false, error: guestContext.error, status: guestContext.status };
  }
  return {
    ok: true,
    data: {
      orgId: guestContext.data.orgId,
      orgName: guestContext.data.orgName,
    },
  };
}
