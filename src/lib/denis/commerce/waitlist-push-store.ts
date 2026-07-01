import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";
import {
  resolvePushSoundProfile,
  resolvePushVibrate,
} from "@/lib/push/push-intelligence";
import { isPushConfigured, sendPush, type PushPayload } from "@/lib/push/vapid";

const PUSH_TTL_SEC = 86_400 * 2;

export type WaitlistPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function pushKey(locationId: string, deviceFingerprint: string): string {
  return `denis:waitlist:push:${locationId}:${deviceFingerprint}`;
}

export async function saveWaitlistPushSubscription(
  locationId: string,
  deviceFingerprint: string,
  subscription: WaitlistPushSubscription
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !locationId || !deviceFingerprint) return;

  try {
    await redis.set(pushKey(locationId, deviceFingerprint), subscription, {
      ex: PUSH_TTL_SEC,
    });
  } catch (error) {
    logRedisDegradation("denis.waitlist.push.save", error);
  }
}

export async function notifyWaitlistGuestPush(
  locationId: string,
  deviceFingerprint: string,
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured()) return false;

  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const sub = await redis.get<WaitlistPushSubscription>(
      pushKey(locationId, deviceFingerprint)
    );
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;

    const result = await sendPush(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      },
      {
        ...payload,
        type: "guest-waitlist-ready",
        soundProfile: resolvePushSoundProfile("guest-waitlist-ready"),
        vibrate: resolvePushVibrate("guest-waitlist-ready"),
        sound: payload.sound ?? true,
        urgent: payload.urgent ?? true,
      }
    );

    if (!result.ok && result.expired) {
      await redis.del(pushKey(locationId, deviceFingerprint));
    }

    return result.ok;
  } catch (error) {
    logRedisDegradation("denis.waitlist.push.notify", error);
    return false;
  }
}
