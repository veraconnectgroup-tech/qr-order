"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AiCreditsPurchaseModal } from "@/components/admin/ai-credits-purchase-modal";
import { AdminPanel, AdminPanelSection } from "@/components/admin/admin-panel";
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
      <AdminPanel
        title="Denis"
        description={
          <>
            KI-Guthaben für{" "}
            <span className="font-medium text-foreground">{locationName}</span>.
          </>
        }
      >
        <AdminPanelSection className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Guthaben
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {creditsBalance.toLocaleString("de-DE")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Verbraucht (gesamt)
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-muted-foreground">
              {creditsLifetimeUsed.toLocaleString("de-DE")}
            </p>
          </div>
        </AdminPanelSection>

        {canEdit && (
          <Button
            type="button"
            className="mt-5 w-full"
            onClick={() => setPurchaseOpen(true)}
          >
            Kredite kaufen
          </Button>
        )}
      </AdminPanel>

      <AiCreditsPurchaseModal
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        packages={packages}
        currency={currency}
      />
    </>
  );
}
