import type { StaffOrderClientSnapshot } from "@/lib/tax/compute-staff-order-totals";
import {
  STAFF_OFFLINE_DB_NAME,
  STAFF_OFFLINE_DB_VERSION,
  MENU_CACHE_STORE,
} from "@/lib/offline/menu-cache";

const STORE_NAME = "staff_orders";

export type StaffOrderQueuePayload = {
  tableId: string;
  clientOrderId: string;
  menuVersion?: string;
  clientSnapshot?: StaffOrderClientSnapshot;
  items: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    notes?: string;
    modifiers: Array<{ modifierId: string }>;
  }>;
  paymentMethod: string;
  notes?: string;
  isTakeaway: boolean;
};

export type StaffOrderQueueItem = {
  id: string;
  clientOrderId: string;
  locationId?: string;
  createdAt: string;
  tableId: string;
  tableName: string;
  menuVersion?: string;
  clientSnapshot?: StaffOrderClientSnapshot;
  payload: StaffOrderQueuePayload;
  status: "pending" | "syncing" | "failed" | "conflict";
  lastError?: string;
  unavailableProducts?: string[];
  attempts: number;
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
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

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        Promise.resolve(fn(store))
          .then((result) => {
            if (result instanceof IDBRequest) {
              result.onsuccess = () => resolve(result.result as T);
              result.onerror = () =>
                reject(result.error ?? new Error("IndexedDB request failed"));
            } else {
              resolve(result);
            }
          })
          .catch(reject);

        tx.oncomplete = () => db.close();
        tx.onerror = () =>
          reject(tx.error ?? new Error("IndexedDB transaction failed"));
      })
  );
}

export async function enqueueStaffOrder(
  item: Omit<StaffOrderQueueItem, "status" | "attempts">
): Promise<StaffOrderQueueItem> {
  const clientOrderId = item.clientOrderId || item.id;
  const entry: StaffOrderQueueItem = {
    ...item,
    clientOrderId,
    id: item.id || clientOrderId,
    payload: {
      ...item.payload,
      clientOrderId,
    },
    status: "pending",
    attempts: 0,
  };

  await withStore("readwrite", (store) => store.put(entry));
  return entry;
}

export async function listQueuedStaffOrders(): Promise<StaffOrderQueueItem[]> {
  return withStore("readonly", (store) => {
    const request = store.getAll();
    return request;
  }).then((items) =>
    (items as StaffOrderQueueItem[]).sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  );
}

export async function updateQueuedStaffOrder(
  item: StaffOrderQueueItem
): Promise<void> {
  await withStore("readwrite", (store) => store.put(item));
}

export async function removeQueuedStaffOrder(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function countPendingStaffOrders(): Promise<number> {
  const items = await listQueuedStaffOrders();
  return items.filter((item) => item.status !== "syncing").length;
}
