/**
 * Fire-and-forget push notify — does not block the caller.
 */
import { formatOrderNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { getRedisClient } from "@/lib/redis/client";

export type PushNotifyType =
  | "new-order"
  | "waiter-call"
  | "order-ready"
  | "payment-request";

type PushNotifyPayload = {
  locationId: string;
  type: PushNotifyType;
  title: string;
  body: string;
  url?: string;
};

const DEBOUNCE_SECONDS = 10;

/** Dev-only fallback when Upstash is not configured locally. */
const devLastSentAt = new Map<string, number>();

function isDevMemoryFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !getRedisClient();
}

function debounceKey(locationId: string, type: PushNotifyType) {
  return `push-debounce:${locationId}:${type}`;
}

/** Returns true when a recent notify for this location+type should be skipped. */
async function isDebounced(
  locationId: string,
  type: PushNotifyType
): Promise<boolean> {
  const key = debounceKey(locationId, type);
  const redis = getRedisClient();

  if (redis) {
    const wasSet = await redis.set(key, "1", {
      nx: true,
      ex: DEBOUNCE_SECONDS,
    });
    return !wasSet;
  }

  if (isDevMemoryFallbackEnabled()) {
    const now = Date.now();
    const last = devLastSentAt.get(key) ?? 0;
    if (now - last < DEBOUNCE_SECONDS * 1000) return true;
    devLastSentAt.set(key, now);
    return false;
  }

  logger.error("Push debounce skipped — Redis not configured", {
    locationId,
    type,
  });
  return false;
}

async function notifyDirect(payload: PushNotifyPayload) {
  void notifyLocationPush(payload.locationId, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
  }).catch((err) => {
    logger.error("Push notify failed", {
      locationId: payload.locationId,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function schedulePushNotify(payload: PushNotifyPayload) {
  if (await isDebounced(payload.locationId, payload.type)) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    await notifyDirect(payload);
    return;
  }

  void fetch(`${baseUrl}/api/push/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    logger.error("Push notify fetch failed", {
      locationId: payload.locationId,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function scheduleWaiterCallPush(locationId: string, tableName: string) {
  void schedulePushNotify({
    locationId,
    type: "waiter-call",
    title: "Waiter call",
    body: `Table ${tableName}`,
    url: "/waiter/calls",
  });
}

export function scheduleOrderReadyPush(
  locationId: string,
  orderNumber: number
) {
  void schedulePushNotify({
    locationId,
    type: "order-ready",
    title: `Order ${formatOrderNumber(orderNumber)} ready`,
    body: "Ready to serve",
    url: "/waiter/orders",
  });
}

export function schedulePaymentRequestPush(
  locationId: string,
  tableName: string,
  tableId?: string
) {
  void schedulePushNotify({
    locationId,
    type: "payment-request",
    title: "Payment requested",
    body: `Table ${tableName}`,
    url: tableId ? `/waiter/tables/${tableId}` : "/waiter",
  });
}

/** Test helper — dev memory fallback only. */
export function clearPushDebounceMemoryCache() {
  devLastSentAt.clear();
}
