"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Connection failed");
      window.location.href = json.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  }

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
            disabled={loading}
          >
            {loading ? "Loading…" : "Manage Stripe account"}
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
            disabled={loading}
          >
            {loading ? "Loading…" : "Connect Stripe →"}
          </Button>
        </div>
      )}
    </div>
  );
}
