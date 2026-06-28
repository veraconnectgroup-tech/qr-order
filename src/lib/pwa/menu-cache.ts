import type { MenuCategory } from "@/components/guest/menu-grid";
import {
  resolveMenuCacheStrategy,
  type MenuCacheSnapshot,
} from "@/lib/offline/service-worker";

export const MENU_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TTL_MS = MENU_CACHE_TTL_MS;

export type MenuCachePayload = {
  cachedAt: number;
  menuVersion: string;
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

export function invalidateGuestMenuCache(slug: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(slug));
  } catch {
    // ignore
  }
}

/** Drop all guest menu caches for a location (M17). */
export function clearGuestMenuCacheForLocation(locationId: string) {
  if (typeof localStorage === "undefined") return;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith("qr-menu-cache-")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as MenuCachePayload;
        if (parsed.locationId === locationId) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function invalidateGuestMenuCacheForLocation(locationId: string) {
  clearGuestMenuCacheForLocation(locationId);

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: "INVALIDATE_MENU_CACHE",
      locationId,
    });
  }
}

export function isGuestMenuCacheStale(
  cached: MenuCachePayload,
  freshMenuVersion: string
): boolean {
  if (!cached.menuVersion) return true;
  return cached.menuVersion !== freshMenuVersion;
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

export function readMenuCacheForTable(
  slug: string,
  token: string
): MenuCachePayload | null {
  const cached = readMenuCache(slug);
  if (!cached || cached.token !== token) return null;
  return cached;
}

export function toMenuCacheSnapshot(
  payload: MenuCachePayload
): MenuCacheSnapshot {
  return {
    slug: payload.slug,
    token: payload.token,
    categories: payload.categories,
    cachedAt: new Date(payload.cachedAt).toISOString(),
    locationId: payload.locationId,
    tableId: payload.tableId,
  };
}

/** Stale-while-revalidate — instant paint from cache, refresh when online. */
export function resolveGuestMenuHydration(input: {
  slug: string;
  token: string;
  freshFetched: boolean;
  online: boolean;
  freshMenuVersion?: string;
}): {
  payload: MenuCachePayload | null;
  useCache: boolean;
  shouldRefresh: boolean;
  showingCachedMenu: boolean;
} {
  const payload = readMenuCacheForTable(input.slug, input.token);
  if (!payload) {
    return {
      payload: null,
      useCache: false,
      shouldRefresh: input.online,
      showingCachedMenu: false,
    };
  }

  if (
    input.freshMenuVersion &&
    isGuestMenuCacheStale(payload, input.freshMenuVersion)
  ) {
    invalidateGuestMenuCache(input.slug);
    return {
      payload: null,
      useCache: false,
      shouldRefresh: input.online,
      showingCachedMenu: false,
    };
  }

  const strategy = resolveMenuCacheStrategy({
    cached: toMenuCacheSnapshot(payload),
    freshFetched: input.freshFetched,
    online: input.online,
  });

  return {
    payload,
    useCache: strategy.useCache,
    shouldRefresh: strategy.shouldRefresh,
    showingCachedMenu: strategy.useCache && !input.freshFetched,
  };
}

export function hydrateInitialMenuCategories(input: {
  slug: string;
  token: string;
  fallback: MenuCategory[];
  menuVersion?: string;
}): { categories: MenuCategory[]; showingCachedMenu: boolean } {
  if (typeof window === "undefined") {
    return { categories: input.fallback, showingCachedMenu: false };
  }

  const hydration = resolveGuestMenuHydration({
    slug: input.slug,
    token: input.token,
    freshFetched: false,
    online: navigator.onLine,
    freshMenuVersion: input.menuVersion,
  });

  if (hydration.useCache && hydration.payload) {
    return {
      categories: hydration.payload.categories,
      showingCachedMenu: hydration.showingCachedMenu,
    };
  }

  return { categories: input.fallback, showingCachedMenu: false };
}
