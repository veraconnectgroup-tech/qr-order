const DB_NAME = "vera-staff-offline";
const DB_VERSION = 1;
const STORE_NAME = "staff_orders";

export type StaffOrderQueueItem = {
  id: string;
  createdAt: string;
  tableId: string;
  tableName: string;
  payload: {
    tableId: string;
    items: Array<{
      productId: string;
      quantity: number;
      notes?: string;
      modifiers: Array<{ modifierId: string }>;
    }>;
    paymentMethod: string;
    notes?: string;
    isTakeaway: boolean;
  };
  status: "pending" | "syncing" | "failed";
  lastError?: string;
  attempts: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
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
  const entry: StaffOrderQueueItem = {
    ...item,
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
