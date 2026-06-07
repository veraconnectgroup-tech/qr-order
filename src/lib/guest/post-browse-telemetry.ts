import type { BrowseEvent } from "@/lib/denis/cognition/browse/browse-types";
import { postDenisSignal } from "@/lib/guest/denis-signal-client";

export type PostBrowseTelemetryInput = {
  tableToken: string;
  tableSessionToken?: string;
  locationId: string;
  tableId: string;
  aiSessionId?: string | null;
  deviceFingerprint?: string | null;
  event: BrowseEvent;
};

/** Fire-and-forget browse event → Denis timeline via signal ingress (P0). */
export async function postBrowseTelemetry(
  input: PostBrowseTelemetryInput
): Promise<void> {
  await postDenisSignal({
    type: "telemetry",
    kind: "browse",
    tableToken: input.tableToken,
    tableSessionToken: input.tableSessionToken,
    locationId: input.locationId,
    tableId: input.tableId,
    aiSessionId: input.aiSessionId ?? undefined,
    deviceFingerprint: input.deviceFingerprint ?? undefined,
    payload: { browseEvent: input.event },
  });
}
