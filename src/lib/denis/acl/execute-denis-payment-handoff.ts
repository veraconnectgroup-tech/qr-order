import { resolveHandoffSession } from "@/lib/denis/acl/resolve-handoff-session";
import {
  loadSessionPaymentBeliefs,
  requestSessionPaymentInPerson,
} from "@/lib/sessions/request-session-payment-in-person";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecuteDenisPaymentHandoffResult =
  | { ok: true; needsMethod: true }
  | {
      ok: true;
      needsMethod: false;
      paymentMethod: SelectablePaymentMethod;
      openPaymentSheet?: boolean;
    }
  | { ok: false; error: string };

/** M28 ACL — bill request with optional payment method (ADR-018). */
export async function executeDenisPaymentHandoff(
  admin: SupabaseClient,
  input: {
    tableId: string;
    locationId: string;
    sessionToken: string;
    paymentMethod?: SelectablePaymentMethod | null;
  }
): Promise<ExecuteDenisPaymentHandoffResult> {
  if (!input.paymentMethod) {
    return { ok: true, needsMethod: true };
  }

  const resolved = await resolveHandoffSession(admin, input);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const beliefs = await loadSessionPaymentBeliefs(
    admin,
    resolved.data.sessionId
  );

  if (beliefs.unpaidCount === 0 || beliefs.amountDue <= 0) {
    return { ok: false, error: "nothing_to_pay" };
  }

  if (beliefs.paymentAlreadyRequested) {
    return { ok: false, error: "payment_already_requested" };
  }

  if (input.paymentMethod === "online") {
    return {
      ok: true,
      needsMethod: false,
      paymentMethod: "online",
      openPaymentSheet: true,
    };
  }

  const result = await requestSessionPaymentInPerson(admin, {
    sessionId: resolved.data.sessionId,
    locationId: resolved.data.locationId,
    tableId: resolved.data.tableId,
    tableName: resolved.data.tableName,
    paymentMethod: input.paymentMethod,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    needsMethod: false,
    paymentMethod: result.paymentMethod,
  };
}
