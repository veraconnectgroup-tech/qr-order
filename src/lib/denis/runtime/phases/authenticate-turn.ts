import { apiError } from "@/lib/api-response";
import {
  assertSufficientCredits,
  resolveAiTurnOrg,
} from "@/lib/denis/commercial";
import type { DenisChatBody } from "@/lib/denis/runtime/turn-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthenticateTurnResult =
  | {
      ok: true;
      orgId: string;
      creditBalanceAfter: number;
    }
  | { ok: false; response: Response };

export async function authenticateTurn(
  admin: SupabaseClient,
  parsed: DenisChatBody
): Promise<AuthenticateTurnResult> {
  const orgResult = await resolveAiTurnOrg(admin, {
    locationId: parsed.locationId,
    tableId: parsed.tableId,
    sessionToken: parsed.sessionToken,
  });
  if (!orgResult.ok) {
    return {
      ok: false,
      response: apiError(orgResult.error, orgResult.status),
    };
  }

  const creditCheck = await assertSufficientCredits(admin, orgResult.data.orgId);
  if (!creditCheck.ok) {
    return {
      ok: false,
      response: apiError("insufficient_credits", 402),
    };
  }

  return {
    ok: true,
    orgId: orgResult.data.orgId,
    creditBalanceAfter: creditCheck.balanceAfter,
  };
}
