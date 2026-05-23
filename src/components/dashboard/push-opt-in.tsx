"use client";

import { Bell, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { urlBase64ToUint8Array } from "@/lib/push/vapid-client";
import { cn } from "@/lib/utils";

type PushState = "unsupported" | "default" | "prompting" | "active" | "denied";

function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function PushOptIn({ className }: { className?: string }) {
  const { locationId } = useDashboard();
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);

  const syncSubscriptionState = useCallback(async () => {
    const vapidKey = getVapidPublicKey();
    if (
      typeof window === "undefined" ||
      !vapidKey ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator)
    ) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      if (existing && Notification.permission === "granted") {
        setState("active");
        return;
      }

      setState("default");
    } catch {
      setState("default");
    }
  }, []);

  useEffect(() => {
    void syncSubscriptionState();
  }, [syncSubscriptionState]);

  async function enablePush() {
    const vapidKey = getVapidPublicKey();
    if (!vapidKey || state === "unsupported" || state === "denied") {
      return;
    }

    setBusy(true);
    setState("prompting");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        if (permission === "denied") {
          toast.error("Notifications blocked in browser settings");
        }
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setState("default");
        toast.error("Could not read push subscription");
        return;
      }

      const res = await fetch("/api/push/subscribe", {
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
      });

      if (!res.ok) {
        setState("default");
        toast.error("Could not save notification subscription");
        return;
      }

      setState("active");
      toast.success("Push notifications enabled");
    } catch {
      setState("default");
      toast.error("Failed to enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("default");
      toast.success("Push notifications disabled");
    } catch {
      toast.error("Could not disable notifications");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported" || !getVapidPublicKey()) {
    return null;
  }

  if (state === "active") {
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
    return (
      <span
        className={cn(
          "hidden text-xs text-zinc-500 sm:inline",
          className
        )}
        title="Enable notifications in browser settings"
      >
        Notifications blocked
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "hidden h-9 gap-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 sm:inline-flex",
        className
      )}
      onClick={() => void enablePush()}
      disabled={busy || state === "prompting"}
    >
      <Bell className="size-4" />
      {busy || state === "prompting" ? "Enabling…" : "Enable notifications"}
    </Button>
  );
}
