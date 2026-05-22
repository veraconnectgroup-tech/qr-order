"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { platformFeeDescription } from "@/lib/constants";

const POPUP_FEATURES = "popup=yes,width=520,height=720,left=100,top=24";

type StripeConnectMessage =
  | { type: "STRIPE_CONNECT_DONE"; onboarded: boolean; stripe?: string }
  | { type: "STRIPE_CONNECT_ERROR" };

export function DashboardStripeConnect({
  connected,
  accountId,
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
        toast.success("Uspešno ste se povezali sa Stripe-om!", {
          description: "Kartična plaćanja su sada aktivna.",
        });
      } else if (stripe === "refresh") {
        toast.message("Nastavite Stripe setup kada budete spremni.");
      } else {
        toast.message("Stripe setup sačuvan. Završite preostale korake u Stripe-u.");
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
        toast.error("Stripe povezivanje nije uspelo. Pokušajte ponovo.");
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
          toast.error(e instanceof Error ? e.message : "Stripe sync failed");
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
      toast.error(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  }

  const busy = loading || syncing;
  const feeLabel = platformFeeDescription(currency);
  const isConnected = connected || showSuccess;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-zinc-50">Plaćanja</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Povežite Stripe nalog restorana — novac ide vama na banku
      </p>

      {isConnected && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-300">
              Uspešno ste se povezali sa Stripe-om
            </p>
            <p className="mt-0.5 text-xs text-green-200/70">
              Gosti mogu platiti karticom. Isplate idu na vaš bankovni račun.
            </p>
          </div>
        </div>
      )}

      {connected ? (
        <div className="mt-4 space-y-3">
          {accountId && (
            <p className="font-mono text-xs text-zinc-600">
              Nalog: {accountId.slice(0, 20)}…
            </p>
          )}
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
            onClick={handleConnect}
            disabled={busy}
          >
            {busy ? "Učitavanje…" : "Upravljaj Stripe nalogom"}
            <ExternalLink className="ml-2 size-4" />
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {!isConnected && (
            <p className="text-sm text-amber-400">Plaćanje nije konfigurisano</p>
          )}
          {!platformReady && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Platforma mora prvo da podesi Stripe Connect. Admin: dodajte{" "}
              <code className="font-mono">STRIPE_SECRET_KEY</code> na Vercel i
              aktivirajte Connect na{" "}
              <a
                href="https://dashboard.stripe.com/connect"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                dashboard.stripe.com/connect
              </a>
              .
            </p>
          )}
          {platformReady && !isConnected && (
            <p className="text-xs text-zinc-500">
              Kliknite dugme — otvori se Stripe prozor gde unosite podatke
              restorana i bankovni račun. Provizija platforme: {feeLabel}.
            </p>
          )}
          <ul className="space-y-1 text-xs text-zinc-500">
            <li>{feeLabel}</li>
            <li>Isplate direktno na vaš bankovni račun</li>
            <li>Visa, Mastercard, Apple Pay, Google Pay</li>
          </ul>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={handleConnect}
            disabled={busy || !platformReady}
          >
            {busy ? "Otvaranje Stripe prozora…" : "Poveži Stripe →"}
          </Button>
        </div>
      )}
    </div>
  );
}
