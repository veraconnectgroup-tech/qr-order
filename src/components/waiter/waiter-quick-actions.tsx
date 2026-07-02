"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Ban, Headphones, Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { patchProductAvailabilityClient } from "@/lib/products/eighty-six-client";
import { hapticLight } from "@/lib/haptics";

type Props = {
  tableId: string;
  tableName: string;
  productId?: string | null;
  productName?: string | null;
};

export function WaiterQuickActions({
  tableId,
  tableName,
  productId,
  productName,
}: Props) {
  const [assistOpen, setAssistOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const callAssistance = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/waiter/assistance-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, message: `${tableName} — konobar traži pomoć` }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Menadžer obavešten");
    } catch {
      toast.error("Nije moguće poslati zahtev");
    } finally {
      setBusy(false);
    }
  }, [tableId, tableName]);

  const mark86 = useCallback(async () => {
    if (!productId) {
      setAssistOpen(true);
      return;
    }
    setBusy(true);
    try {
      await patchProductAvailabilityClient(productId, false);
      toast.success(`${productName ?? "Stavka"} — 86`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška");
    } finally {
      setBusy(false);
    }
  }, [productId, productName]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Button
          asChild
          variant="outline"
          className="min-h-12 flex-col gap-1 border-dash-border-subtle px-2 text-xs font-semibold"
          onClick={() => hapticLight()}
        >
          <Link href={`/waiter/new-order?tableId=${tableId}`}>
            <Plus className="size-4" />
            Dodaj stavku
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="min-h-12 flex-col gap-1 border-dash-border-subtle px-2 text-xs font-semibold"
          onClick={() => {
            hapticLight();
            void mark86();
          }}
        >
          <Ban className="size-4" />
          86 item
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="min-h-12 flex-col gap-1 border-dash-border-subtle px-2 text-xs font-semibold"
          onClick={() => {
            hapticLight();
            void callAssistance();
          }}
        >
          <Headphones className="size-4" />
          Asistencija
        </Button>
      </div>

      <Sheet open={assistOpen} onOpenChange={setAssistOpen}>
        <SheetContent
          side="bottom"
          className="dashboard-theme border-dash-border bg-dash-bg text-dash-text"
        >
          <SheetHeader>
            <SheetTitle>86 item</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-sm text-dash-text-muted">
            Otvori narudžbinu i označi stavku kao nedostupnu, ili koristi meni editor u adminu.
          </p>
          <Button asChild className="mt-4 min-h-12 w-full bg-dash-accent">
            <Link href={`/waiter/new-order?tableId=${tableId}`}>
              <UtensilsCrossed className="mr-2 size-4" />
              Nova narudžbina
            </Link>
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
