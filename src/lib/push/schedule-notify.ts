/**
 * Fire-and-forget push notify — does not block the caller.
 */
import { formatOrderNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

export type PushNotifyType = "new-order" | "waiter-call" | "order-ready";

type PushNotifyPayload = {
  locationId: string;
  type: PushNotifyType;
  title: string;
  body: string;
  url?: string;
};

const DEBOUNCE_MS = 10_000;
const lastSentAt = new Map<string, number>();

function isDebounced(locationId: string, type: PushNotifyType) {
  const key = `${locationId}:${type}`;
  const now = Date.now();
  const last = lastSentAt.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) return true;
  lastSentAt.set(key, now);
  return false;
}

function notifyDirect(payload: PushNotifyPayload) {
  if (isDebounced(payload.locationId, payload.type)) return;

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
  if (isDebounced(payload.locationId, payload.type)) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    notifyDirect(payload);
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
