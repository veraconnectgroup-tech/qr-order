import { resilientFetch } from "@/lib/fetch/resilient-fetch";

export async function patchProductAvailabilityClient(
  productId: string,
  available: boolean
): Promise<{
  productId: string;
  productName: string;
  isAvailable: boolean;
  changed: boolean;
}> {
  const { data, error } = await resilientFetch<{
    ok: boolean;
    data: {
      productId: string;
      productName: string;
      isAvailable: boolean;
      changed: boolean;
    } | null;
    error: string | null;
  }>(`/api/products/${productId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available }),
  });

  if (error || !data?.data) {
    throw new Error(error ?? "Could not update product availability.");
  }

  return data.data;
}

export type EightySixListItem = {
  productId: string;
  productName: string;
  menuSection: string | null;
  eightySixedAt: string | null;
  isAvailable: boolean;
};

export async function loadTodayEightySixListClient(input: {
  locationId: string;
  station?: "kitchen" | "bar";
}): Promise<EightySixListItem[]> {
  const params = new URLSearchParams();
  if (input.station) params.set("station", input.station);

  const { data, error } = await resilientFetch<{
    ok: boolean;
    data: { items: EightySixListItem[] } | null;
    error: string | null;
  }>(`/api/locations/${input.locationId}/eighty-six?${params.toString()}`);

  if (error || !data?.data) {
    throw new Error(error ?? "Could not load 86 list.");
  }

  return data.data.items;
}
