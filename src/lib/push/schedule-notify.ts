/**
 * Fire-and-forget push notify — does not block the caller.
 */
import { formatOrderNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import { getRedisClient } from "@/lib/redis/client";

export type PushNotifyType = "new-order" | "waiter-call" | "order-ready";

type PushNotifyPayload = {
  locationId: string;
  type: PushNotifyType;
  title: string;
  body: string;
  url?: string;
};

const DEBOUNCE_SECONDS = 10;
const KEY_PREFIX = "push-debounce:";

/** Dev-only fallback when Upstash is not configured locally. */
const devMemoryCache = new Map<string, number>();

function isDevMemoryFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !getRedisClient();
}

function debounceKey(locationId: string, type: PushNotifyType) {
  return `${KEY_PREFIX}${locationId}:${type}`;
}

/** Returns true when a recent notify for this location+type should be skipped. */
async function isDebounced(
  locationId: string,
  type: PushNotifyType
): Promise<boolean> {
  const key = debounceKey(locationId, type);
  const redis = getRedisClient();

  if (redis) {
    const acquired = await redis.set(key, "1", {
      nx: true,
      ex: DEBOUNCE_SECONDS,
    });
    return acquired === null;
  }

  if (isDevMemoryFallbackEnabled()) {
    const now = Date.now();
    const last = devMemoryCache.get(key) ?? 0;
    if (now - last < DEBOUNCE_SECONDS * 1000) return true;
    devMemoryCache.set(key, now);
    return false;
  }

  logger.error("Push debounce skipped — Redis not configured", {
    locationId,
    type,
  });
  return false;
}

async function deliverPush(payload: PushNotifyPayload) {
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

export function schedulePushNotify(payload: PushNotifyPayload) {
  void runSchedulePushNotify(payload);
}

async function runSchedulePushNotify(payload: PushNotifyPayload) {
  if (await isDebounced(payload.locationId, payload.type)) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    await deliverPush(payload);
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
  schedulePushNotify({
    locationId,
    type: "waiter-call",
    title: "Waiter call",
    body: `Table ${tableName}`,
    url: "/dashboard/waiter-calls",
  });
}

export function scheduleOrderReadyPush(
  locationId: string,
  orderNumber: number
) {
  schedulePushNotify({
    locationId,
    type: "order-ready",
    title: `Order ${formatOrderNumber(orderNumber)} ready`,
    body: "Ready for pickup",
    url: "/dashboard/orders",
  });
}

/** Test helper — dev memory fallback only. */
export function clearPushDebounceMemoryCache() {
  devMemoryCache.clear();
}
