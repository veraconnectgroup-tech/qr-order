"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import { platformFeeDescriptionEn } from "@/lib/constants";

export function StripeConnectButton({
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
      if (!res.ok) throw new Error(json.error);
      window.location.href = json.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <AdminPanel title="Payments">
      {connected ? (
        <>
          <p className="text-sm text-emerald-400">✓ Stripe connected</p>
          {accountId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Account: {accountId.slice(0, 16)}...
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Active — accepting guest card payments.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? "Loading…" : "Update Stripe account"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-amber-400">⚠ Payments not configured</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect a Stripe account to accept guest card payments.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>Platform fee: {platformFeeDescriptionEn()}</li>
            <li>Payouts directly to your bank account</li>
            <li>Visa, Mastercard, Apple Pay, Google Pay</li>
          </ul>
          <Button className="mt-4" onClick={handleConnect} disabled={loading}>
            {loading ? "Loading…" : "Connect with Stripe →"}
          </Button>
        </>
      )}
    </AdminPanel>
  );
}
