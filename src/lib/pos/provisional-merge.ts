import {
  PROVISIONAL_KITCHEN_TIMEOUT_MS,
  type ProvisionalOrderPayload,
  type PosBroadcastEvent,
} from "@/lib/pos/provisional-types";

export type ProvisionalEntry = {
  payload: ProvisionalOrderPayload;
  receivedAt: number;
  conflictReason?: string;
};

export type ProvisionalMap = Map<string, ProvisionalEntry>;

export function createProvisionalMap(): ProvisionalMap {
  return new Map();
}

export function applyPosBroadcastEvent(
  map: ProvisionalMap,
  event: PosBroadcastEvent,
  receivedAt = Date.now()
): ProvisionalMap {
  const next = new Map(map);

  if (event.type === "provisional_order") {
    if (next.has(event.payload.clientOrderId)) {
      return next;
    }
    next.set(event.payload.clientOrderId, {
      payload: event.payload,
      receivedAt,
    });
    return next;
  }

  if (event.type === "order_confirmed") {
    next.delete(event.clientOrderId);
    return next;
  }

  if (event.type === "order_conflict") {
    const existing = next.get(event.clientOrderId);
    if (existing) {
      next.set(event.clientOrderId, {
        ...existing,
        conflictReason: event.reason,
      });
    }
    return next;
  }

  return next;
}

export function pruneExpiredProvisionals(
  map: ProvisionalMap,
  now = Date.now(),
  timeoutMs = PROVISIONAL_KITCHEN_TIMEOUT_MS
): ProvisionalMap {
  const next = new Map(map);
  for (const [clientOrderId, entry] of next) {
    if (entry.conflictReason) continue;
    if (now - entry.receivedAt >= timeoutMs) {
      next.delete(clientOrderId);
    }
  }
  return next;
}

export function listActiveProvisionals(
  map: ProvisionalMap,
  now = Date.now(),
  timeoutMs = PROVISIONAL_KITCHEN_TIMEOUT_MS
): ProvisionalEntry[] {
  const pruned = pruneExpiredProvisionals(map, now, timeoutMs);
  return [...pruned.values()].sort(
    (a, b) => a.receivedAt - b.receivedAt
  );
}

export function countTimedOutProvisionals(
  map: ProvisionalMap,
  now = Date.now(),
  timeoutMs = PROVISIONAL_KITCHEN_TIMEOUT_MS
): number {
  let count = 0;
  for (const entry of map.values()) {
    if (entry.conflictReason) continue;
    if (now - entry.receivedAt >= timeoutMs) count += 1;
  }
  return count;
}
