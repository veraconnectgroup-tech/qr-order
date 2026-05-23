import type { MenuCategory } from "@/components/guest/menu-grid";

const TTL_MS = 24 * 60 * 60 * 1000;

export type MenuCachePayload = {
  cachedAt: number;
  slug: string;
  token: string;
  orgName: string;
  logoUrl: string | null;
  locationName: string;
  tableName: string;
  zoneName: string | null;
  categories: MenuCategory[];
  taxPercent: number;
  currency: string;
  locationId: string;
  tableId: string;
  timezone: string;
  orderingEnabled: boolean;
  acceptingOrders: boolean;
  aiConciergeEnabled: boolean;
};

function cacheKey(slug: string) {
  return `qr-menu-cache-${slug}`;
}

export function writeMenuCache(slug: string, payload: Omit<MenuCachePayload, "cachedAt">) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      cacheKey(slug),
      JSON.stringify({ ...payload, cachedAt: Date.now() } satisfies MenuCachePayload)
    );
  } catch {
    // Storage full or private mode.
  }
}

export function readMenuCache(slug: string): MenuCachePayload | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MenuCachePayload;
    if (Date.now() - parsed.cachedAt > TTL_MS) {
      localStorage.removeItem(cacheKey(slug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
