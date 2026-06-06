"use client";

import {
  listQueuedStaffOrders,
  removeQueuedStaffOrder,
  resetStuckSyncingStaffOrders,
  updateQueuedStaffOrder,
  withQueuePayloadClientOrderId,
  type StaffOrderQueueItem,
} from "@/lib/offline/order-queue";
import {
  postStaffOrderApi,
  recoverStaffOrderSync,
} from "@/lib/offline/post-staff-order-api";
import {
  broadcastOrderConfirmed,
  broadcastOrderConflict,
} from "@/lib/pos/provisional-broadcast";
import { isPosKitchenProvisionalEnabled } from "@/lib/pos/feature-flags";

export type SyncState = {
  syncing: boolean;
  pendingCount: number;
  failed: StaffOrderQueueItem[];
  conflicted: StaffOrderQueueItem[];
  lastSyncAt: Date | null;
};

export type StaffOrderSyncSuccess = {
  clientOrderId: string;
  orderId: string;
  orderNumber: number;
  tableName: string;
  total: number;
};

type SyncListener = (state: SyncState) => void;
type SyncSuccessListener = (result: StaffOrderSyncSuccess) => void;
type SyncConflictListener = (item: StaffOrderQueueItem) => void;

let syncing = false;
let lastSyncAt: Date | null = null;
const listeners = new Set<SyncListener>();
const successListeners = new Set<SyncSuccessListener>();
const conflictListeners = new Set<SyncConflictListener>();

function notify(state: Partial<SyncState> & { pendingCount?: number; failed?: StaffOrderQueueItem[]; conflicted?: StaffOrderQueueItem[] }) {
  void getSyncState().then((current) => {
    const next = { ...current, ...state };
    for (const listener of listeners) {
      listener(next);
    }
  });
}

export async function getSyncState(): Promise<SyncState> {
  const items = await listQueuedStaffOrders();
  const failed = items.filter((item) => item.status === "failed");
  const conflicted = items.filter((item) => item.status === "conflict");
  const pendingCount = items.length;

  return {
    syncing,
    pendingCount,
    failed,
    conflicted,
    lastSyncAt,
  };
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  void getSyncState().then(listener);
  return () => listeners.delete(listener);
}

export function onStaffOrderSyncSuccess(listener: SyncSuccessListener): () => void {
  successListeners.add(listener);
  return () => successListeners.delete(listener);
}

export function onStaffOrderSyncConflict(listener: SyncConflictListener): () => void {
  conflictListeners.add(listener);
  return () => conflictListeners.delete(listener);
}

function emitSyncSuccess(result: StaffOrderSyncSuccess) {
  for (const listener of successListeners) {
    listener(result);
  }
}

function emitSyncConflict(item: StaffOrderQueueItem) {
  for (const listener of conflictListeners) {
    listener(item);
  }
}

async function syncOne(item: StaffOrderQueueItem): Promise<boolean> {
  const repaired = withQueuePayloadClientOrderId(item);
  if (repaired.payload !== item.payload || repaired.clientOrderId !== item.clientOrderId) {
    await updateQueuedStaffOrder(repaired);
  }

  const updating: StaffOrderQueueItem = {
    ...repaired,
    status: "syncing",
    attempts: repaired.attempts + 1,
  };
  await updateQueuedStaffOrder(updating);

  const result = await postStaffOrderApi(updating.payload);

  if (!result.ok && result.unavailableProducts !== undefined) {
    const products = result.unavailableProducts;
    const conflict: StaffOrderQueueItem = {
      ...updating,
      status: "conflict",
      unavailableProducts: products,
      lastError:
        products?.length ?
          `Nicht verfügbar: ${products.join(", ")}`
        : "Produkte nicht verfügbar",
    };
    await updateQueuedStaffOrder(conflict);
    emitSyncConflict(conflict);
    if (
      repaired.locationId &&
      isPosKitchenProvisionalEnabled(repaired.locationId)
    ) {
      void broadcastOrderConflict(
        repaired.locationId,
        repaired.clientOrderId,
        conflict.lastError ?? "Produkte nicht verfügbar"
      );
    }
    return false;
  }

  if (!result.ok) {
    const failed: StaffOrderQueueItem = {
      ...updating,
      status: "failed",
      lastError: result.error,
    };
    await updateQueuedStaffOrder(failed);
    return false;
  }

  if (repaired.locationId && isPosKitchenProvisionalEnabled(repaired.locationId)) {
    void broadcastOrderConfirmed(
      repaired.locationId,
      repaired.clientOrderId,
      result.data.orderId,
      result.data.orderNumber
    );
  }

  await removeQueuedStaffOrder(repaired.id);
  emitSyncSuccess({
    clientOrderId: repaired.clientOrderId,
    orderId: result.data.orderId,
    orderNumber: result.data.orderNumber,
    tableName: result.data.tableName,
    total: result.data.total,
  });
  return true;
}

export async function syncQueuedStaffOrders(): Promise<{
  synced: number;
  failed: number;
}> {
  if (syncing) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  syncing = true;
  notify({ syncing: true });

  let synced = 0;
  let failed = 0;

  try {
    const items = await listQueuedStaffOrders();
    const toSync = items.filter(
      (item) =>
        item.status === "pending" ||
        item.status === "failed" ||
        item.status === "conflict"
    );

    for (const item of toSync) {
      const ok = await syncOne(item);
      if (ok) synced += 1;
      else failed += 1;
      notify({});
    }

    lastSyncAt = new Date();
  } finally {
    syncing = false;
    notify({ syncing: false, lastSyncAt });
  }

  return { synced, failed };
}

export async function retryQueuedStaffOrder(id: string): Promise<boolean> {
  const items = await listQueuedStaffOrders();
  const item = items.find((entry) => entry.id === id);
  if (!item) return false;

  const reset: StaffOrderQueueItem = {
    ...withQueuePayloadClientOrderId(item),
    status: "pending",
    lastError: undefined,
    unavailableProducts: undefined,
  };
  await updateQueuedStaffOrder(reset);
  await syncQueuedStaffOrders();
  const after = await listQueuedStaffOrders();
  return !after.some((entry) => entry.id === id);
}

export async function removeUnavailableFromQueuedStaffOrder(
  id: string,
  unavailableNames: string[]
): Promise<boolean> {
  const items = await listQueuedStaffOrders();
  const item = items.find((entry) => entry.id === id);
  if (!item) return false;

  const unavailable = new Set(unavailableNames.map((name) => name.toLowerCase()));
  const filteredItems = item.payload.items.filter((line) => {
    const name = line.productName?.toLowerCase();
    return !name || !unavailable.has(name);
  });

  if (filteredItems.length === 0) {
    await removeQueuedStaffOrder(id);
    return false;
  }

  const updated: StaffOrderQueueItem = {
    ...item,
    status: "pending",
    lastError: undefined,
    unavailableProducts: undefined,
    payload: {
      ...item.payload,
      items: filteredItems,
    },
  };
  await updateQueuedStaffOrder(updated);
  await syncQueuedStaffOrders();
  const after = await listQueuedStaffOrders();
  return !after.some((entry) => entry.id === id && entry.status === "conflict");
}

export async function discardQueuedStaffOrder(id: string): Promise<void> {
  await removeQueuedStaffOrder(id);
  notify({});
}

export function initOfflineSyncManager(): () => void {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => {
    void syncQueuedStaffOrders();
  };

  window.addEventListener("online", onOnline);

  void resetStuckSyncingStaffOrders().then(() => {
    if (navigator.onLine) {
      void syncQueuedStaffOrders();
    }
  });

  return () => window.removeEventListener("online", onOnline);
}
