import type { Category, ProductWithModifiers } from "@/types";

export const STAFF_OFFLINE_DB_NAME = "vera-staff-offline";
export const STAFF_OFFLINE_DB_VERSION = 2;
export const MENU_CACHE_STORE = "menu_cache";

export type CachedStaffMenu = {
  locationId: string;
  menuVersion: string;
  categories: Array<Category & { products: ProductWithModifiers[] }>;
  cachedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(
      STAFF_OFFLINE_DB_NAME,
      STAFF_OFFLINE_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("staff_orders")) {
        db.createObjectStore("staff_orders", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MENU_CACHE_STORE)) {
        db.createObjectStore(MENU_CACHE_STORE, { keyPath: "locationId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export function computeMenuVersion(
  rows: Array<{ updated_at?: string | null }>
): string {
  const timestamps = rows
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value));
  if (!timestamps.length) {
    return new Date(0).toISOString();
  }
  return timestamps.sort().at(-1)!;
}

export async function persistStaffMenuCache(
  entry: CachedStaffMenu
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MENU_CACHE_STORE, "readwrite");
    tx.objectStore(MENU_CACHE_STORE).put(entry);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB menu cache write failed"));
  });
}

export async function loadStaffMenuCache(
  locationId: string
): Promise<CachedStaffMenu | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MENU_CACHE_STORE, "readonly");
    const request = tx.objectStore(MENU_CACHE_STORE).get(locationId);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as CachedStaffMenu | undefined) ?? null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB menu cache read failed"));
  });
}
