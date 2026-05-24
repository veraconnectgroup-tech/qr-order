"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { loadPrinterSetup } from "@/lib/printer/load-printer-setup";
import { printReceiptOrder } from "@/lib/printer/print-receipt-order";
import type { OrderWithDetails } from "@/types";
import { cn } from "@/lib/utils";

export function ReceiptPrintButton({
  order,
  orgName,
  currency,
  className,
  label = "Print Receipt",
  light = false,
}: {
  order: OrderWithDetails;
  orgName: string;
  currency: string;
  className?: string;
  label?: string;
  light?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handlePrint() {
    if (busy) return;
    setBusy(true);
    try {
      const setup = await loadPrinterSetup();
      await printReceiptOrder(order, orgName, currency, setup);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handlePrint()}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition disabled:opacity-50 touch-manipulation",
        light
          ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          : "border-dash-surface-overlay text-dash-text-secondary hover:border-dash-surface-overlay hover:bg-dash-surface-raised",
        className
      )}
    >
      <Receipt className="size-3.5" />
      {busy ? "Printing…" : label}
    </button>
  );
}
