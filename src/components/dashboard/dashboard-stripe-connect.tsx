"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { platformFeeDescriptionEn } from "@/lib/constants";

const POPUP_FEATURES = "popup=yes,width=520,height=720,left=100,top=24";

function friendlyStripeError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("signed up for connect")) {
    return "Stripe Connect is not enabled on the QR Order platform account yet. Contact hello@qrorder.app to enable card payments.";
  }
  if (lower.includes("platform-profile") || lower.includes("managing losses")) {
    return "Stripe Connect platform setup is incomplete. Contact hello@qrorder.app.";
  }
  if (
    lower.includes("stripe_secret_key") ||
    lower.includes("not configured") ||
    lower.includes("app url is not configured")
  ) {
    return "Card payments are temporarily unavailable. Please try again later.";
  }
  if (lower.includes("invalid api key")) {
    return "Payment configuration error. Contact hello@qrorder.app.";
  }
  if (
    lower.includes("test mode") ||
    lower.includes("live mode") ||
    lower.includes("similar object exists in test mode")
  ) {
    return "Stripe test/live mode mismatch. Contact hello@qrorder.app.";
  }

  // Show short Stripe messages as-is; hide env noise and long dumps.
  if (
    message.length <= 160 &&
    !message.includes("STRIPE_") &&
    !lower.includes("environment variable")
  ) {
    return message;
  }

  return "Stripe connection failed. Please try again or contact hello@qrorder.app.";
}

type StripeConnectMessage =
  | { type: "STRIPE_CONNECT_DONE"; onboarded: boolean; stripe?: string }
  | { type: "STRIPE_CONNECT_ERROR" };

export function DashboardStripeConnect({
  connected,
  accountId: _accountId,
  platformReady,
  currency = "EUR",
}: {
  connected: boolean;
  accountId: string | null;
  platformReady: boolean;
  currency?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const popupRef = useRef<Window | null>(null);
  const popupPollRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(connected);

  const clearPopupPoll = useCallback(() => {
    if (popupPollRef.current != null) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  }, []);

  const handleConnectResult = useCallback(
    (onboarded: boolean, stripe?: string) => {
      if (onboarded) {
        setShowSuccess(true);
        toast.success("Stripe connected", {
          description: "Card payments are now enabled.",
        });
      } else if (stripe === "refresh") {
        toast.message("Continue Stripe setup when you're ready.");
      } else {
        toast.message("Stripe setup saved. Finish any remaining steps in Stripe.");
      }
      router.refresh();
    },
    [router]
  );

  useEffect(() => {
    setShowSuccess(connected);
  }, [connected]);

  useEffect(() => {
    function onMessage(event: MessageEvent<StripeConnectMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "STRIPE_CONNECT_DONE") {
        clearPopupPoll();
        setLoading(false);
        popupRef.current = null;
        handleConnectResult(event.data.onboarded, event.data.stripe);
      }
      if (event.data?.type === "STRIPE_CONNECT_ERROR") {
        clearPopupPoll();
        setLoading(false);
        popupRef.current = null;
        toast.error("Stripe connection failed. Please try again.");
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [clearPopupPoll, handleConnectResult]);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam !== "complete" && stripeParam !== "refresh") return;

    let cancelled = false;

    async function syncAfterReturn() {
      setSyncing(true);
      try {
        const res = await fetch("/api/stripe/connect");
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Could not verify Stripe status");
        }

        if (!cancelled) {
          handleConnectResult(Boolean(json.data?.onboarded), stripeParam ?? undefined);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            friendlyStripeError(
              e instanceof Error ? e.message : "Stripe sync failed"
            )
          );
        }
      } finally {
        if (!cancelled) {
          setSyncing(false);
          router.replace("/dashboard/settings");
        }
      }
    }

    syncAfterReturn();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, handleConnectResult]);

  useEffect(() => {
    return () => clearPopupPoll();
  }, [clearPopupPoll]);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Stripe connection failed");
      }
      if (!json.data?.url) {
        throw new Error("Stripe did not return an onboarding link.");
      }

      const popup = window.open(json.data.url, "stripe-connect", POPUP_FEATURES);

      if (popup) {
        popupRef.current = popup;
        popup.focus();
        clearPopupPoll();
        popupPollRef.current = window.setInterval(() => {
          if (popup.closed) {
            clearPopupPoll();
            popupRef.current = null;
            setLoading(false);
          }
        }, 500);
        return;
      }

      window.location.href = json.data.url;
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Connection failed";
      toast.error(friendlyStripeError(raw));
      setLoading(false);
    }
  }

  const busy = loading || syncing;
  const feeLabel = platformFeeDescriptionEn(currency);
  const isConnected = connected || showSuccess;

  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface p-6">
      <h2 className="text-lg font-semibold text-dash-text">Payments</h2>
      <p className="mt-1 text-sm text-dash-text-disabled">
        Connect your restaurant&apos;s Stripe account — payouts go to your bank
      </p>

      {isConnected && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-300">
              Stripe connected
            </p>
            <p className="mt-0.5 text-xs text-green-200/70">
              Guests can pay by card. Payouts go to your bank account.
            </p>
          </div>
        </div>
      )}

      {connected ? (
        <div className="mt-4 space-y-3">
          <Button
            variant="outline"
            className="border-dash-surface-overlay bg-dash-bg text-dash-text-secondary hover:bg-dash-surface-raised"
            onClick={handleConnect}
            disabled={busy}
          >
            {busy ? "Loading…" : "Manage Stripe account"}
            <ExternalLink className="ml-2 size-4" />
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {!isConnected && !platformReady && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Online payments are not available yet. Please contact
              hello@qrorder.app.
            </p>
          )}
          {!isConnected && platformReady && (
            <>
              <p className="text-sm text-dash-text-muted">
                Connect your account so guests can pay by card. Funds go directly
                to your bank.
              </p>
              <ul className="space-y-1 text-xs text-dash-text-disabled">
                <li>Platform fee: {feeLabel}</li>
                <li>Visa, Mastercard, Apple Pay, Google Pay</li>
              </ul>
            </>
          )}
          <Button
            className="bg-dash-accent hover:bg-dash-accent-hover"
            onClick={handleConnect}
            disabled={busy || !platformReady}
          >
            {busy ? "Opening Stripe…" : "Connect Stripe →"}
          </Button>
        </div>
      )}
    </div>
  );
}
