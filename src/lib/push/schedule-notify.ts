/**
 * Fire-and-forget push notify — does not block the caller.
 */
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";

type PushNotifyPayload = {
  locationId: string;
  title: string;
  body: string;
  url?: string;
};

function notifyDirect(payload: PushNotifyPayload) {
  void notifyLocationPush(payload.locationId, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
  }).catch((err) => {
    logger.error("Push notify failed", {
      locationId: payload.locationId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function schedulePushNotify(payload: PushNotifyPayload) {
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
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function scheduleNewOrderPush(
  locationId: string,
  orderNumber: number,
  tableName: string
) {
  schedulePushNotify({
    locationId,
    title: `Nova narudžba #${String(orderNumber).padStart(3, "0")}`,
    body: `Sto ${tableName}`,
    url: "/dashboard/orders",
  });
}

export function scheduleWaiterCallPush(locationId: string, tableName: string) {
  schedulePushNotify({
    locationId,
    title: "Poziv konobara",
    body: `Sto ${tableName}`,
    url: "/dashboard/waiter-calls",
  });
}
