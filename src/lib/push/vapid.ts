import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  sound?: boolean;
  urgent?: boolean;
  type?: string;
  soundProfile?: "ding" | "ring" | "alarm" | "default";
  vibrate?: number[];
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type SendPushResult =
  | { ok: true }
  | { ok: false; expired: boolean; error: string };

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails("mailto:info@verait.de", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPush(
  subscription: PushSubscriptionInput,
  payload: PushPayload
): Promise<SendPushResult> {
  if (!ensureVapid()) {
    return { ok: false, expired: false, error: "VAPID not configured" };
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    const error = err as { statusCode?: number; message?: string };
    const expired = error.statusCode === 410 || error.statusCode === 404;

    return {
      ok: false,
      expired,
      error: error.message ?? String(err),
    };
  }
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}
