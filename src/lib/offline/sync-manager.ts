"use client";

import { resilientFetch } from "@/lib/fetch/resilient-fetch";
import {
  listQueuedStaffOrders,
  removeQueuedStaffOrder,
  updateQueuedStaffOrder,
  type StaffOrderQueueItem,
} from "@/lib/offline/order-queue";

export type SyncState = {
  syncing: boolean;
  pendingCount: number;
  failed: StaffOrderQueueItem[];
  lastSyncAt: Date | null;
};

type SyncListener = (state: SyncState) => void;

let syncing = false;
let lastSyncAt: Date | null = null;
const listeners = new Set<SyncListener>();

function notify(state: Partial<SyncState> & { pendingCount?: number; failed?: StaffOrderQueueItem[] }) {
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
  const pendingCount = items.filter((item) => item.status !== "syncing").length;

  return {
    syncing,
    pendingCount,
    failed,
    lastSyncAt,
  };
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  void getSyncState().then(listener);
  return () => listeners.delete(listener);
}

async function syncOne(item: StaffOrderQueueItem): Promise<boolean> {
  const updating: StaffOrderQueueItem = {
    ...item,
    status: "syncing",
    attempts: item.attempts + 1,
  };
  await updateQueuedStaffOrder(updating);

  const { data: body, error, status } = await resilientFetch<{
    data: {
      orderId: string;
      orderNumber: number;
      tableName: string;
      total: number;
    } | null;
    error: string | null;
  }>("/api/staff-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item.payload),
  });

  if (error || !body?.data) {
    const failed: StaffOrderQueueItem = {
      ...updating,
      status: "failed",
      lastError: error ?? body?.error ?? `Sync failed (${status ?? "?"})`,
    };
    await updateQueuedStaffOrder(failed);
    return false;
  }

  await removeQueuedStaffOrder(item.id);
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
      (item) => item.status === "pending" || item.status === "failed"
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
    ...item,
    status: "pending",
    lastError: undefined,
  };
  await updateQueuedStaffOrder(reset);
  await syncQueuedStaffOrders();
  const after = await listQueuedStaffOrders();
  return !after.some((entry) => entry.id === id);
}

export function initOfflineSyncManager(): () => void {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => {
    void syncQueuedStaffOrders();
  };

  window.addEventListener("online", onOnline);

  if (navigator.onLine) {
    void syncQueuedStaffOrders();
  }

  return () => window.removeEventListener("online", onOnline);
}
