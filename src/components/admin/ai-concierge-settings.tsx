"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AiCreditsPurchaseModal } from "@/components/admin/ai-credits-purchase-modal";
import { AdminPanel, AdminPanelSection } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";
import type { AiCreditPackage } from "@/types";

export type DenisAiOpsSnapshot = {
  turns24h: number;
  timelineEvents24h: number;
  lowBalance: boolean;
  refreshedAt: string;
};

export function AiConciergeSettings({
  locationName,
  creditsBalance,
  creditsLifetimeUsed,
  aiOps,
  packages,
  currency,
  canEdit,
}: {
  locationName: string;
  creditsBalance: number;
  creditsLifetimeUsed: number;
  aiOps?: DenisAiOpsSnapshot | null;
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
            Pro Denis-Nachricht mit KI wird 1 Kredit abgebucht; Menü-Browse ohne
            KI ist kostenlos. Bei niedrigem Guthaben erhalten Sie eine
            Benachrichtigung.
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

        {aiOps && (
          <AdminPanelSection className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ops (24h)
              </p>
              {aiOps.lowBalance && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                  Niedriges Guthaben
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">KI-Turns</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {aiOps.turns24h.toLocaleString("de-DE")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timeline-Events</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-muted-foreground">
                  {aiOps.timelineEvents24h.toLocaleString("de-DE")}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Aktualisiert{" "}
              {new Date(aiOps.refreshedAt).toLocaleString("de-DE", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </AdminPanelSection>
        )}

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
