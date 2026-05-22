"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DashboardStripeConnect({
  connected,
  accountId,
}: {
  connected: boolean;
  accountId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

        if (json.data?.onboarded) {
          toast.success("Stripe connected — card payments are enabled.");
        } else if (stripeParam === "refresh") {
          toast.message("Continue Stripe setup when you're ready.");
        } else {
          toast.message("Stripe setup saved. Finish any remaining steps in Stripe.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Stripe sync failed");
      } finally {
        if (!cancelled) {
          setSyncing(false);
          router.replace("/dashboard/settings");
          router.refresh();
        }
      }
    }

    syncAfterReturn();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

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
      window.location.href = json.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  }

  const busy = loading || syncing;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-zinc-50">Payments</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Accept card payments from guests via Stripe Connect
      </p>

      {connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-green-400">Stripe connected</p>
          {accountId && (
            <p className="font-mono text-xs text-zinc-600">
              {accountId.slice(0, 20)}…
            </p>
          )}
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
            onClick={handleConnect}
            disabled={busy}
          >
            {busy ? "Loading…" : "Manage Stripe account"}
            <ExternalLink className="ml-2 size-4" />
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-amber-400">Payments not configured</p>
          <ul className="space-y-1 text-xs text-zinc-500">
            <li>2% platform fee per transaction</li>
            <li>Payouts to your bank account</li>
            <li>Visa, Mastercard, Apple Pay, Google Pay</li>
          </ul>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={handleConnect}
            disabled={busy}
          >
            {busy ? "Loading…" : "Connect Stripe →"}
          </Button>
        </div>
      )}
    </div>
  );
}
