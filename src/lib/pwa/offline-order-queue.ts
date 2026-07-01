import { OFFLINE_QUEUE_TTL_MS } from "@/lib/offline/service-worker";

const QUEUE_KEY = "qr-order-queue";

export type QueuedOrder = {
  id: string;
  sessionToken: string;
  tableToken: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

export type FlushOfflineOrderQueueResult = {
  sent: number;
  failed: number;
  flushedIds: string[];
};

function readQueue(): QueuedOrder[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedOrder[];
    return pruneExpiredQueuedOrders(parsed);
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOrder[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(pruneExpiredQueuedOrders(queue)));
}

export function pruneExpiredQueuedOrders(
  queue: QueuedOrder[],
  now = Date.now()
): QueuedOrder[] {
  return queue.filter((item) => now - item.createdAt < OFFLINE_QUEUE_TTL_MS);
}

export function getPendingOfflineOrderCount(): number {
  return readQueue().length;
}

export function listPendingOfflineOrders(): QueuedOrder[] {
  return readQueue();
}

export function enqueueOfflineOrder(input: {
  sessionToken: string;
  tableToken: string;
  payload: Record<string, unknown>;
}) {
  const queue = readQueue();
  queue.push({
    id: crypto.randomUUID(),
    sessionToken: input.sessionToken,
    tableToken: input.tableToken,
    payload: input.payload,
    createdAt: Date.now(),
  });
  writeQueue(queue);
}

export async function flushOfflineOrderQueue(): Promise<FlushOfflineOrderQueueResult> {
  const queue = readQueue();
  if (!queue.length) return { sent: 0, failed: 0, flushedIds: [] };

  const remaining: QueuedOrder[] = [];
  const flushedIds: string[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
        cache: "no-store",
      });
      if (res.ok) {
        sent += 1;
        flushedIds.push(item.id);
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { sent, failed: remaining.length, flushedIds };
}

export async function registerOrderSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync?.register("qr-order-sync");
  } catch {
    // Background Sync unsupported.
  }
}
