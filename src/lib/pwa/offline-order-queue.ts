const QUEUE_KEY = "qr-order-queue";

type QueuedOrder = {
  id: string;
  sessionToken: string;
  tableToken: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

function readQueue(): QueuedOrder[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedOrder[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOrder[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
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

export async function flushOfflineOrderQueue() {
  const queue = readQueue();
  if (!queue.length) return { sent: 0, failed: 0 };

  const remaining: QueuedOrder[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        sent += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { sent, failed: remaining.length };
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
