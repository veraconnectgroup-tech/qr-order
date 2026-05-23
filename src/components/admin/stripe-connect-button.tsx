"use client";

import { useState } from "react";
import { toast } from "sonner";
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
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Payments</h2>
      {connected ? (
        <>
          <p className="mt-2 text-sm text-green-600">✓ Stripe connected</p>
          {accountId && (
            <p className="mt-1 text-xs text-neutral-500">
              Account: {accountId.slice(0, 16)}...
            </p>
          )}
          <p className="mt-2 text-sm text-neutral-600">
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
          <p className="mt-2 text-sm text-amber-600">
            ⚠ Payments not configured
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Connect a Stripe account to accept guest card payments.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-neutral-500">
            <li>Platform fee: {platformFeeDescriptionEn()}</li>
            <li>Payouts directly to your bank account</li>
            <li>Visa, Mastercard, Apple Pay, Google Pay</li>
          </ul>
          <Button className="mt-4" onClick={handleConnect} disabled={loading}>
            {loading ? "Loading…" : "Connect with Stripe →"}
          </Button>
        </>
      )}
    </div>
  );
}
