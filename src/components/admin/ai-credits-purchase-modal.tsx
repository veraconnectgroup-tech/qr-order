"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import type { AiCreditPackage } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AiCreditsPurchaseModal({
  open,
  onOpenChange,
  packages,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: AiCreditPackage[];
  currency: string;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function purchase(packageId: string) {
    setLoadingId(packageId);
    try {
      const res = await fetch("/api/ai/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Purchase failed.");
        return;
      }

      const url = json.data?.url as string | undefined;
      if (!url) {
        toast.error("Checkout could not be started.");
        return;
      }

      window.location.href = url;
    } catch {
      toast.error("Purchase failed.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kredite kaufen</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-4"
            >
              <div>
                <p className="font-semibold text-neutral-900">{pkg.name}</p>
                <p className="text-sm text-neutral-500">
                  {pkg.credits.toLocaleString("de-DE")} Kredite
                </p>
              </div>
              <Button
                onClick={() => purchase(pkg.id)}
                disabled={loadingId !== null}
              >
                {loadingId === pkg.id
                  ? "Weiterleitung…"
                  : formatPrice(pkg.price_cents / 100, pkg.currency || currency)}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
