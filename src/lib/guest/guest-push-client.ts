import {
  registerGuestPushServiceWorker,
  ServiceWorkerUnavailableError,
} from "@/lib/pwa/register-service-worker";
import { urlBase64ToUint8Array } from "@/lib/push/vapid-client";

function buildTimeVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(timeoutError)), ms);
    }),
  ]);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  ms: number
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("save_timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function guestPushErrorMessage(error: unknown): string {
  if (error instanceof ServiceWorkerUnavailableError) {
    return error.message;
  }
  if (error instanceof Error && error.message === "permission_timeout") {
    return "Browser did not respond to the notification prompt.";
  }
  if (error instanceof Error && error.message === "subscribe_timeout") {
    return "Push subscription timed out. Reload and try again.";
  }
  if (error instanceof Error && error.message === "save_timeout") {
    return "Saving the subscription timed out.";
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Notifications were blocked.";
    }
    if (error.name === "AbortError") {
      return "Notification setup was cancelled.";
    }
  }
  return "Failed to enable notifications.";
}

export async function loadGuestPushConfig(): Promise<{
  publicKey: string;
  configured: boolean;
}> {
  try {
    const res = await fetchWithTimeout("/api/push/config", {}, 8_000);
    const json = (await res.json().catch(() => null)) as {
      data?: { publicKey?: string | null; configured?: boolean };
    } | null;

    const publicKey =
      json?.data?.publicKey?.trim() || buildTimeVapidPublicKey() || "";

    return {
      publicKey,
      configured: Boolean(json?.data?.configured && publicKey),
    };
  } catch {
    const fallback = buildTimeVapidPublicKey();
    return { publicKey: fallback, configured: Boolean(fallback) };
  }
}

async function registerGuestPushServiceWorkerWithRetry(): Promise<ServiceWorkerRegistration> {
  try {
    return await registerGuestPushServiceWorker();
  } catch (firstError) {
    if (!(firstError instanceof ServiceWorkerUnavailableError)) {
      throw firstError;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    return registerGuestPushServiceWorker();
  }
}

export async function enableGuestPushSubscription(input: {
  tableToken: string;
  sessionToken: string;
  vapidPublicKey: string;
}): Promise<void> {
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await withTimeout(
      Notification.requestPermission(),
      30_000,
      "permission_timeout"
    );
  }

  if (permission !== "granted") {
    if (permission === "denied") {
      throw new Error("permission_denied");
    }
    throw new Error("permission_default");
  }

  const registration = await registerGuestPushServiceWorkerWithRetry();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(input.vapidPublicKey),
      }),
      15_000,
      "subscribe_timeout"
    );
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("invalid_subscription");
  }

  const res = await fetchWithTimeout(
    "/api/guest/push/subscribe",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableToken: input.tableToken,
        sessionToken: input.sessionToken,
        subscription: {
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        },
      }),
    },
    15_000
  );

  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new Error(body?.error ?? "Could not save notification subscription");
  }
}

export async function syncGuestPushSubscriptionState(
  vapidPublicKey: string
): Promise<"active" | "default" | "denied"> {
  if (!vapidPublicKey) return "default";

  if (Notification.permission === "denied") {
    return "denied";
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "default";

    const scriptUrl =
      registration.active?.scriptURL ??
      registration.waiting?.scriptURL ??
      registration.installing?.scriptURL;
    if (!scriptUrl?.endsWith("/push-sw.js")) return "default";

    const existing = await registration.pushManager.getSubscription();
    if (existing && Notification.permission === "granted") {
      return "active";
    }
  } catch {
    // Fall through — show opt-in.
  }

  return "default";
}
