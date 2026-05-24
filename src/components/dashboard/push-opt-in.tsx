"use client";

import { Bell, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  registerAppServiceWorker,
  ServiceWorkerUnavailableError,
} from "@/lib/pwa/register-service-worker";
import { urlBase64ToUint8Array } from "@/lib/push/vapid-client";
import { cn } from "@/lib/utils";

type PushState = "unsupported" | "default" | "active" | "denied";

function buildTimeVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

function pushErrorMessage(error: unknown): string {
  if (error instanceof ServiceWorkerUnavailableError) {
    return error.message;
  }
  if (error instanceof Error && error.message === "permission_timeout") {
    return "Browser did not respond to the notification prompt. Check site permissions and try again.";
  }
  if (error instanceof Error && error.message === "subscribe_timeout") {
    return "Push subscription timed out. Reload the page and try again.";
  }
  if (error instanceof Error && error.message === "save_timeout") {
    return "Saving the subscription timed out. Check your connection and try again.";
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

async function loadPushConfig(): Promise<{
  publicKey: string;
  configured: boolean;
}> {
  try {
    const res = await fetchWithTimeout("/api/push/config", {}, 8_000);
    const json = (await res.json().catch(() => null)) as {
      data?: { publicKey?: string | null; configured?: boolean };
    } | null;

    const publicKey =
      json?.data?.publicKey?.trim() ||
      buildTimeVapidPublicKey() ||
      "";

    return {
      publicKey,
      configured: Boolean(json?.data?.configured && publicKey),
    };
  } catch {
    const fallback = buildTimeVapidPublicKey();
    return { publicKey: fallback, configured: Boolean(fallback) };
  }
}

export function PushOptIn({
  className,
  variant = "topbar",
}: {
  className?: string;
  variant?: "topbar" | "banner";
}) {
  const { locationId } = useDashboard();
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [serverConfigured, setServerConfigured] = useState(false);

  const browserSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const syncSubscriptionState = useCallback(async (publicKey: string) => {
    if (!publicKey || !browserSupported) {
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const registration = await registerAppServiceWorker();
      const existing = await registration.pushManager.getSubscription();

      if (existing && Notification.permission === "granted") {
        setState("active");
        return;
      }

      setState("default");
    } catch {
      setState("default");
    }
  }, [browserSupported]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const config = await loadPushConfig();
      if (cancelled) return;

      setVapidPublicKey(config.publicKey);
      setServerConfigured(config.configured);
      setConfigLoading(false);

      if (!config.publicKey || !browserSupported) {
        setState("unsupported");
        return;
      }

      await syncSubscriptionState(config.publicKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [browserSupported, syncSubscriptionState]);

  async function enablePush() {
    if (!vapidPublicKey || state === "unsupported" || state === "denied") {
      return;
    }

    setBusy(true);
    setLastError(null);

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await withTimeout(
          Notification.requestPermission(),
          30_000,
          "permission_timeout"
        );
      }

      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        if (permission === "denied") {
          const message = "Notifications blocked in browser settings";
          setLastError(message);
          toast.error(message);
        }
        return;
      }

      const registration = await registerAppServiceWorker();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }),
          15_000,
          "subscribe_timeout"
        );
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setState("default");
        const message = "Could not read push subscription";
        setLastError(message);
        toast.error(message);
        return;
      }

      const res = await fetchWithTimeout(
        "/api/push/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
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

      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setState("default");
        const message = body?.error ?? "Could not save notification subscription";
        setLastError(message);
        toast.error(message);
        return;
      }

      setState("active");
      setLastError(null);
      toast.success("Push notifications enabled");
    } catch (error) {
      setState("default");
      const message = pushErrorMessage(error);
      setLastError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setLastError(null);
    try {
      const registration = await registerAppServiceWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetchWithTimeout(
          "/api/push/subscribe",
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          },
          15_000
        );
      }
      setState("default");
      toast.success("Push notifications disabled");
    } catch {
      toast.error("Could not disable notifications");
    } finally {
      setBusy(false);
    }
  }

  if (configLoading) {
    return null;
  }

  if (!browserSupported) {
    return null;
  }

  if (!vapidPublicKey) {
    if (variant === "banner") return null;
    return (
      <span
        className={cn("hidden text-xs text-amber-500/90 sm:inline", className)}
        title="Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel env"
      >
        Push not configured
      </span>
    );
  }

  if (!serverConfigured) {
    if (variant === "banner") return null;
    return (
      <span
        className={cn("hidden text-xs text-amber-500/90 sm:inline", className)}
        title="VAPID_PRIVATE_KEY is missing on the server"
      >
        Push incomplete (missing private key)
      </span>
    );
  }

  if (state === "active") {
    if (variant === "banner") return null;
    return (
      <button
        type="button"
        onClick={() => void disablePush()}
        disabled={busy}
        className={cn("hidden sm:inline-flex", className)}
      >
        <Badge
          variant="secondary"
          className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
        >
          <BellRing className="size-3" />
          {busy ? "Updating…" : "Notifications on"}
        </Badge>
      </button>
    );
  }

  if (state === "denied") {
    if (variant === "banner") {
      return (
        <div
          className={cn(
            "sticky top-0 z-50 border-b border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200",
            className
          )}
        >
          Obavijesti su blokirane u postavkama browsera.
        </div>
      );
    }

    return (
      <span
        className={cn(
          "hidden text-xs text-dash-text-disabled sm:inline",
          className
        )}
        title="Enable notifications in browser settings"
      >
        Notifications blocked
      </span>
    );
  }

  if (variant === "banner") {
    return (
      <div
        role="region"
        aria-label="Enable push notifications"
        className={cn(
          "sticky top-0 z-50 border-b border-blue-500/30 bg-gradient-to-r from-blue-600/90 to-orange-500/80 px-4 py-3 text-white shadow-sm",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <Bell className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Uključi push obavijesti</p>
            <p className="text-xs text-white/85">
              Narudžbe, pozivi i računi — odmah na telefon.
            </p>
            {lastError && !busy && (
              <p className="mt-1 text-[11px] text-red-200">{lastError}</p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void enablePush()}
            className="h-10 shrink-0 bg-white font-semibold text-blue-700 hover:bg-blue-50"
          >
            {busy ? "…" : "Uključi"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("hidden sm:flex sm:flex-col sm:items-end", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 text-dash-text-muted hover:bg-dash-surface-raised hover:text-dash-text"
        onClick={() => void enablePush()}
        disabled={busy}
      >
        <Bell className="size-4" />
        {busy ? "Enabling…" : "Enable notifications"}
      </Button>
      {lastError && !busy && (
        <span className="mt-1 max-w-[220px] text-right text-[11px] leading-snug text-red-400">
          {lastError}
        </span>
      )}
    </div>
  );
}
