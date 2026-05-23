import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";

export type TableSessionPayload = {
  sessionId: string;
  sessionToken: string;
  tableId: string;
  tableName: string;
  locationId: string;
};

export function isSessionExpiredError(message: string) {
  return /session expired or invalid/i.test(message);
}

export async function fetchTableSession(
  tableToken: string
): Promise<TableSessionPayload | null> {
  const res = await fetch(
    `/api/tables/${encodeURIComponent(tableToken)}/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) return null;

  const json = (await res.json()) as { data?: TableSessionPayload };
  return json.data ?? null;
}

export function syncTableSessionStores(
  slug: string,
  tableToken: string,
  data: TableSessionPayload,
  tableId?: string | null
) {
  useGuestSession.getState().setSession({
    sessionId: data.sessionId,
    sessionToken: data.sessionToken,
    tableId: tableId ?? data.tableId,
    tableName: data.tableName,
    locationId: data.locationId,
    restaurantSlug: slug,
  });
  useCart
    .getState()
    .setSession(slug, tableToken, data.tableName, data.sessionToken);
}

/** Resolve or create an active table session and sync guest + cart stores. */
export async function ensureTableSession(
  slug: string,
  tableToken: string,
  tableId?: string | null
): Promise<string | null> {
  const data = await fetchTableSession(tableToken);
  if (!data) return null;

  syncTableSessionStores(slug, tableToken, data, tableId);
  return data.sessionToken;
}
