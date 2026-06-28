/**
 * Fire-and-forget push notify — does not block the caller.
 */
import { formatOrderNumber } from "@/lib/format";
import { logger } from "@/lib/logger";
import { notifyLocationPush } from "@/lib/push/notify-location";
import {
  formatGroupedPushMessage,
  resolvePushSoundProfile,
  resolvePushVibrate,
  shouldGroupPushType,
  type PushNotifyType,
} from "@/lib/push/push-intelligence";
import { getRedisClient } from "@/lib/redis/client";

export type { PushNotifyType } from "@/lib/push/push-intelligence";

type PushNotifyPayload = {
  locationId: string;
  type: PushNotifyType;
  title: string;
  body: string;
  url?: string;
  sound?: boolean;
  urgent?: boolean;
  assignedStaffId?: string | null;
  broadcast?: boolean;
};

const DEBOUNCE_SECONDS = 10;

/** Dev-only fallback when Upstash is not configured locally. */
const devLastSentAt = new Map<string, number>();
const devGroupCounts = new Map<string, number>();

function isDevMemoryFallbackEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && !getRedisClient();
}

function debounceKey(locationId: string, type: PushNotifyType) {
  return `push-debounce:${locationId}:${type}`;
}

function groupKey(locationId: string, type: PushNotifyType) {
  return `push-group:${locationId}:${type}`;
}

async function incrementPushGroup(
  locationId: string,
  type: PushNotifyType
): Promise<number> {
  const key = groupKey(locationId, type);
  const redis = getRedisClient();

  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    return count;
  }

  if (isDevMemoryFallbackEnabled()) {
    const count = (devGroupCounts.get(key) ?? 0) + 1;
    devGroupCounts.set(key, count);
    return count;
  }

  return 1;
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

function enrichPayload(payload: PushNotifyPayload): PushNotifyPayload & {
  soundProfile: ReturnType<typeof resolvePushSoundProfile>;
  vibrate?: number[];
} {
  const soundProfile = resolvePushSoundProfile(payload.type);
  const urgent =
    payload.urgent ??
    (payload.type === "staff-allergy" ||
      payload.type === "staff-urgent" ||
      payload.type === "waiter-call");
  const sound =
    payload.sound ??
    (urgent ||
      payload.type === "new-order" ||
      payload.type === "waiter-call");

  return {
    ...payload,
    urgent,
    sound,
    soundProfile,
    vibrate: resolvePushVibrate(payload.type),
  };
}

async function notifyDirect(payload: PushNotifyPayload) {
  let finalPayload = enrichPayload(payload);

  if (shouldGroupPushType(payload.type)) {
    const count = await incrementPushGroup(payload.locationId, payload.type);
    if (count > 1) {
      const grouped = formatGroupedPushMessage(
        payload.type,
        count,
        payload.body
      );
      finalPayload = {
        ...finalPayload,
        title: grouped.title,
        body: grouped.body,
      };
    }
  }

  void notifyLocationPush(
    finalPayload.locationId,
    {
      title: finalPayload.title,
      body: finalPayload.body,
      url: finalPayload.url,
      sound: finalPayload.sound,
      urgent: finalPayload.urgent,
      type: finalPayload.type,
      soundProfile: finalPayload.soundProfile,
      vibrate: finalPayload.vibrate,
    },
    {
      assignedStaffId: finalPayload.assignedStaffId,
      broadcast: finalPayload.broadcast ?? finalPayload.urgent,
    }
  ).catch((err) => {
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

  const enriched = enrichPayload(payload);
  void fetch(`${baseUrl}/api/push/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(enriched),
  }).catch((err) => {
    logger.error("Push notify fetch failed", {
      locationId: payload.locationId,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function scheduleNewOrderPush(input: {
  locationId: string;
  orderNumber: number;
  tableName: string;
  assignedStaffId?: string | null;
}) {
  void schedulePushNotify({
    locationId: input.locationId,
    type: "new-order",
    title: `Novi order ${formatOrderNumber(input.orderNumber)}`,
    body: `Sto ${input.tableName}`,
    url: "/waiter/orders",
    sound: true,
    assignedStaffId: input.assignedStaffId,
    broadcast: false,
  });
}

export function scheduleWaiterCallPush(locationId: string, tableName: string) {
  void schedulePushNotify({
    locationId,
    type: "waiter-call",
    title: "Pozovi konobara",
    body: `Sto ${tableName}`,
    url: "/waiter/calls",
    sound: true,
    urgent: true,
    broadcast: true,
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
    sound: true,
  });
}

export function schedulePaymentRequestPush(
  locationId: string,
  tableName: string,
  tableId?: string,
  assignedStaffId?: string | null
) {
  void schedulePushNotify({
    locationId,
    type: "payment-request",
    title: "Payment requested",
    body: `Table ${tableName}`,
    url: tableId ? `/waiter/tables/${tableId}` : "/waiter",
    assignedStaffId,
    broadcast: false,
  });
}

export function scheduleStaffAllergyPush(input: {
  locationId: string;
  tableName: string;
  message: string;
  tableId?: string;
}) {
  void schedulePushNotify({
    locationId: input.locationId,
    type: "staff-allergy",
    title: "Denis — ALERGIJA",
    body: `${input.tableName}: ${input.message}`,
    url: input.tableId ? `/waiter/tables/${input.tableId}` : "/kitchen",
    sound: true,
    urgent: true,
    broadcast: true,
  });
}

export function scheduleStaffAlertPush(input: {
  locationId: string;
  message: string;
  tableName?: string;
  url?: string;
  urgent?: boolean;
  assignedStaffId?: string | null;
}) {
  void schedulePushNotify({
    locationId: input.locationId,
    type: input.urgent ? "staff-urgent" : "staff-alert",
    title: input.urgent ? "Denis — HITNO" : "Denis — staff alert",
    body: input.tableName
      ? `${input.tableName}: ${input.message}`
      : input.message,
    url: input.url ?? "/dashboard",
    sound: input.urgent,
    urgent: input.urgent,
    broadcast: input.urgent,
    assignedStaffId: input.assignedStaffId,
  });
}

/** Guest waitlist — table ready with no-show grace window. */
export function scheduleWaitlistReadyPush(input: {
  locationId: string;
  guestName: string;
  timeoutMinutes: number;
  waitlistUrl: string;
}) {
  void schedulePushNotify({
    locationId: input.locationId,
    type: "waitlist-ready",
    title: "Vaš sto je spreman!",
    body: `${input.guestName}, imate ${input.timeoutMinutes} min da dođete.`,
    url: input.waitlistUrl,
    sound: true,
    urgent: true,
    broadcast: true,
  });
}

/** Test helper — dev memory fallback only. */
export function clearPushDebounceMemoryCache() {
  devLastSentAt.clear();
  devGroupCounts.clear();
}
