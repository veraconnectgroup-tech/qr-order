/**
 * Offline capability orchestration — guest degraded mode (Y2).
 * Wraps existing PWA menu cache + order queue with typed state.
 */

import type { MenuCategory } from "@/components/guest/menu-grid";

export type CartLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
};

export type QueuedOrder = {
  id: string;
  items: CartLine[];
  tableId: string;
  tableToken: string;
  sessionToken: string;
  createdAt: string;
  syncStatus: "pending" | "synced" | "failed";
};

export type OfflineCapability = {
  menuCache: boolean;
  cartPersistence: boolean;
  queuedOrders: QueuedOrder[];
  lastSyncAt: string | null;
  offlineSince: string | null;
};

export type OfflineMode = "online" | "intermittent" | "offline";

export const OFFLINE_QUEUE_TTL_MS = 2 * 60 * 60 * 1000;
export const OFFLINE_CART_KEY = "qr-offline-cart";
export const OFFLINE_STATE_KEY = "qr-offline-capability";
export const OFFLINE_QUEUE_KEY = "qr-order-queue-v2";

export function resolveOfflineMode(input: {
  navigatorOnline: boolean;
  hasMenuCache: boolean;
  pendingOrders: number;
}): OfflineMode {
  if (input.navigatorOnline && input.pendingOrders === 0) return "online";
  if (input.navigatorOnline && input.pendingOrders > 0) return "intermittent";
  if (!input.navigatorOnline && input.hasMenuCache) return "offline";
  return input.navigatorOnline ? "online" : "offline";
}

export function offlineGuestMessage(mode: OfflineMode, language = "sr"): string | null {
  const lang = language.toLowerCase().slice(0, 2);
  if (mode === "online") return null;

  if (mode === "intermittent") {
    if (lang === "de") return "Bestellung gespeichert — wir senden sie, sobald die Verbindung wieder da ist.";
    if (lang === "en") return "Order saved — we'll send it as soon as connection returns.";
    return "Narudžba spremljena — šaljemo čim se veza vrati.";
  }

  if (lang === "de") return "Offline-Modus — Bestellungen werden gesendet, sobald die Verbindung wieder da ist. Denis-Chat ist deaktiviert.";
  if (lang === "en") return "Offline mode — orders will be sent when connection returns. Denis chat is disabled.";
  return "Offline mod — narudžbe će biti poslane kad se veza vrati. Denis chat nije dostupan.";
}

export function isDenisChatAllowedOffline(mode: OfflineMode): boolean {
  return mode === "online";
}

export function pruneExpiredQueuedOrders(
  orders: QueuedOrder[],
  now = Date.now()
): QueuedOrder[] {
  return orders.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    if (Number.isNaN(created)) return false;
    return now - created < OFFLINE_QUEUE_TTL_MS;
  });
}

export function buildOfflineCapability(input: {
  menuCached: boolean;
  queuedOrders: QueuedOrder[];
  lastSyncAt: string | null;
  offlineSince: string | null;
}): OfflineCapability {
  return {
    menuCache: input.menuCached,
    cartPersistence: true,
    queuedOrders: pruneExpiredQueuedOrders(input.queuedOrders),
    lastSyncAt: input.lastSyncAt,
    offlineSince: input.offlineSince,
  };
}

export type MenuCacheSnapshot = {
  slug: string;
  token: string;
  categories: MenuCategory[];
  cachedAt: string;
  locationId: string;
  tableId: string;
};

/** Stale-while-revalidate: serve cache immediately, refresh when online. */
export function resolveMenuCacheStrategy(input: {
  cached: MenuCacheSnapshot | null;
  freshFetched: boolean;
  online: boolean;
}): { useCache: boolean; shouldRefresh: boolean } {
  if (!input.cached) {
    return { useCache: false, shouldRefresh: input.online };
  }
  if (input.online) {
    return { useCache: true, shouldRefresh: !input.freshFetched };
  }
  return { useCache: true, shouldRefresh: false };
}

export type OfflineSyncResult = {
  synced: QueuedOrder[];
  failed: QueuedOrder[];
  expired: number;
  staffAlert: string | null;
};

export function summarizeOfflineSync(result: OfflineSyncResult): string | null {
  if (!result.synced.length) return null;
  return `${result.synced.length} offline narudžbe sync-ane`;
}

export function mergeQueuedOrder(
  queue: QueuedOrder[],
  order: Omit<QueuedOrder, "id" | "createdAt" | "syncStatus">
): QueuedOrder[] {
  const entry: QueuedOrder = {
    ...order,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
  };
  return pruneExpiredQueuedOrders([...queue, entry]);
}

/** Service worker cache tags for guest shell + menu. */
export const SW_CACHE_NAMES = {
  appShell: "guest-app-shell",
  menuData: "menu-data",
  staticAssets: "guest-static",
} as const;

export const SW_ROUTES = {
  menuStaleWhileRevalidate: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(products|categories)(\/|\?).*/i,
  orderQueueSyncTag: "qr-order-sync",
  menuRefreshTag: "refresh-menu-cache",
} as const;
