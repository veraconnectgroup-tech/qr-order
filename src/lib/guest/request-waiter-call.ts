import { postDenisSignal } from "@/lib/guest/denis-signal-client";

/** Guest waiter call via Denis signal → ACT (ADR-019 Phase C). */
export async function requestGuestWaiterCall(input: {
  tableToken: string;
  sessionToken?: string | null;
  locationId?: string;
  tableId?: string;
  label?: string;
}): Promise<void> {
  await postDenisSignal({
    type: "chip",
    chipId: "situation-waiter",
    label: input.label ?? "Waiter",
    tableToken: input.tableToken,
    sessionToken: input.sessionToken ?? undefined,
    tableSessionToken: input.sessionToken ?? undefined,
    locationId: input.locationId,
    tableId: input.tableId,
    structuredIntent: "HANDOFF_WAITER",
  });
}
