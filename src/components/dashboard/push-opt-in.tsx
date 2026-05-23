"use client";

import { Bell, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
        return;
      }

      setState("active");
    } catch {
      setState("default");
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported" || !getVapidPublicKey()) {
    return null;
  }

  if (state === "active") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "hidden gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 sm:inline-flex",
          className
        )}
      >
        <BellRing className="size-3" />
        Obaveštenja aktivna
      </Badge>
    );
  }

  if (state === "denied") {
    return null;
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
      {busy || state === "prompting" ? "Uključujem…" : "Uključi obaveštenja"}
    </Button>
  );
}
