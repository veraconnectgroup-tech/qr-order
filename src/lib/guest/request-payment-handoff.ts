import { postDenisSignal } from "@/lib/guest/denis-signal-client";
import type { SelectablePaymentMethod } from "@/lib/payment-methods";

/** Guest payment handoff via Denis signal → ACT (0 LLM). */
export async function requestGuestPaymentHandoff(input: {
  tableToken: string;
  sessionToken?: string | null;
  locationId?: string;
  tableId?: string;
  method: SelectablePaymentMethod;
  label?: string;
}) {
  return postDenisSignal({
    type: "chip",
    chipId: "payment-handoff",
    label: input.label ?? input.method,
    tableToken: input.tableToken,
    sessionToken: input.sessionToken ?? undefined,
    tableSessionToken: input.sessionToken ?? undefined,
    locationId: input.locationId,
    tableId: input.tableId,
    structuredIntent: "HANDOFF_PAY",
    handoffPaymentMethod: input.method,
  });
}
