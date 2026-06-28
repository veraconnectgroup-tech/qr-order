import type { GuestManualCartSnapshot } from "@/lib/guest/manual-cart-snapshot";

export type PartyCartDeviceSnapshot = {
  deviceFingerprint: string;
  revision: number;
  snapshot: GuestManualCartSnapshot | null;
};

export type PartyCartResponse = {
  partyMode: "shared_cart" | "per_device";
  tableSessionId: string;
  devices: PartyCartDeviceSnapshot[];
  mergedRevision: number;
};

export async function fetchPartyCart(
  tableToken: string,
  sessionToken: string
): Promise<PartyCartResponse | null> {
  const params = new URLSearchParams({
    tableToken,
    sessionToken,
  });

  const res = await fetch(`/api/guest/party-cart?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { data?: PartyCartResponse };
  return json.data ?? null;
}
