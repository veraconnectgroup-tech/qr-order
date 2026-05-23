"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AiCreditsPurchaseModal } from "@/components/admin/ai-credits-purchase-modal";
import { Button } from "@/components/ui/button";
import type { AiCreditPackage } from "@/types";

export function AiConciergeSettings({
  locationName,
  creditsBalance,
  creditsLifetimeUsed,
  packages,
  currency,
  canEdit,
}: {
  locationName: string;
  creditsBalance: number;
  creditsLifetimeUsed: number;
  packages: AiCreditPackage[];
  currency: string;
  canEdit: boolean;
}) {
  const searchParams = useSearchParams();
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("ai") === "purchased") {
      toast.success("Kredite erfolgreich gekauft.");
    }
    if (searchParams.get("ai") === "cancelled") {
      toast.message("Kauf abgebrochen.");
    }
  }, [searchParams]);

  return (
    <>
      <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">AI Concierge</h2>
        <p className="mt-1 text-sm text-neutral-500">
          KI-Guthaben für{" "}
          <span className="font-medium text-neutral-700">{locationName}</span>.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Guthaben
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
              {creditsBalance.toLocaleString("de-DE")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Verbraucht (gesamt)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-700">
              {creditsLifetimeUsed.toLocaleString("de-DE")}
            </p>
          </div>
        </div>

        {canEdit && (
          <Button
            type="button"
            className="mt-5 w-full"
            onClick={() => setPurchaseOpen(true)}
          >
            Kredite kaufen
          </Button>
        )}
      </div>

      <AiCreditsPurchaseModal
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        packages={packages}
        currency={currency}
      />
    </>
  );
}
