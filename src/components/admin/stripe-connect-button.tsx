"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { platformFeeDescription } from "@/lib/constants";

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
      toast.error(e instanceof Error ? e.message : "Greška");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Plaćanja</h2>
      {connected ? (
        <>
          <p className="mt-2 text-sm text-green-600">✓ Stripe povezan</p>
          {accountId && (
            <p className="mt-1 text-xs text-neutral-500">
              Nalog: {accountId.slice(0, 16)}...
            </p>
          )}
          <p className="mt-2 text-sm text-neutral-600">
            Aktivan — prihvata uplate od gostiju.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? "Učitavanje..." : "Ažuriraj Stripe nalog"}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-amber-600">
            ⚠ Plaćanje nije konfigurisano
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Povežite Stripe nalog da biste primali uplate od gostiju.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-neutral-500">
            <li>Provizija platforme: {platformFeeDescription()}</li>
            <li>Isplate direktno na vaš bankovni račun</li>
            <li>Visa, Mastercard, Apple Pay, Google Pay</li>
          </ul>
          <Button className="mt-4" onClick={handleConnect} disabled={loading}>
            {loading ? "Učitavanje..." : "Poveži sa Stripe →"}
          </Button>
        </>
      )}
    </div>
  );
}
