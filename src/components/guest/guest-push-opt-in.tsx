"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { Button } from "@/components/ui/button";
import {
  enableGuestPushSubscription,
  guestPushErrorMessage,
  loadGuestPushConfig,
  syncGuestPushSubscriptionState,
} from "@/lib/guest/guest-push-client";
import { cn } from "@/lib/utils";

type PushState = "unsupported" | "default" | "active" | "denied";

export function GuestPushOptIn({
  tableToken,
  sessionToken,
  className,
}: {
  tableToken: string;
  sessionToken: string;
  className?: string;
}) {
  const { tUI } = useAppLocale();
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

  const syncState = useCallback(
    async (publicKey: string) => {
      if (!publicKey || !browserSupported) return;
      const next = await syncGuestPushSubscriptionState(publicKey);
      setState(next);
    },
    [browserSupported]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const config = await loadGuestPushConfig();
      if (cancelled) return;

      setVapidPublicKey(config.publicKey);
      setServerConfigured(config.configured);
      setConfigLoading(false);

      if (!config.publicKey || !browserSupported) {
        setState("unsupported");
        return;
      }

      await syncState(config.publicKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [browserSupported, syncState]);

  async function enablePush() {
    if (!vapidPublicKey || state === "unsupported" || state === "denied") {
      return;
    }

    setBusy(true);
    setLastError(null);

    try {
      await enableGuestPushSubscription({
        tableToken,
        sessionToken,
        vapidPublicKey,
      });
      setState("active");
      toast.success(tUI("push.optIn.enabled"));
    } catch (error) {
      if (error instanceof Error && error.message === "permission_denied") {
        setState("denied");
        const message = tUI("push.optIn.denied");
        setLastError(message);
        toast.error(message);
        return;
      }

      setState("default");
      const message = guestPushErrorMessage(error);
      setLastError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (configLoading) return null;
  if (!browserSupported || !vapidPublicKey || !serverConfigured) return null;
  if (state === "active" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <div
        className={cn(
          "rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200",
          className
        )}
      >
        {tUI("push.optIn.denied")}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={tUI("push.optIn.title")}
      className={cn(
        "rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-950/80 to-zinc-900/90 px-4 py-3 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Bell className="size-5 shrink-0 text-orange-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">
            {tUI("push.optIn.title")}
          </p>
          <p className="text-xs text-zinc-400">{tUI("push.optIn.body")}</p>
          {lastError && !busy && (
            <p className="mt-1 text-[11px] text-red-300">{lastError}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void enablePush()}
          className="h-10 shrink-0 bg-orange-500 font-semibold text-white hover:bg-orange-600"
        >
          {busy ? "…" : tUI("push.optIn.enable")}
        </Button>
      </div>
    </div>
  );
}
