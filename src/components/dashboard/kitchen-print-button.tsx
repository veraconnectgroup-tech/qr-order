"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { loadPrinterSetup } from "@/lib/printer/load-printer-setup";
import {
  printKitchenOrder,
  type KitchenPrintResult,
} from "@/lib/printer/print-kitchen-order";
import { printKitchenTicket } from "@/lib/kitchen/print-ticket";
import type { OrderWithDetails } from "@/types";
import { cn } from "@/lib/utils";

export function KitchenPrintButton({
  order,
  orgName,
  className,
  label = "Print",
  showAutoBadge = false,
  onResult,
}: {
  order: OrderWithDetails;
  orgName: string;
  className?: string;
  label?: string;
  showAutoBadge?: boolean;
  onResult?: (result: KitchenPrintResult) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handlePrint() {
    if (busy) return;
    setBusy(true);
    try {
      const setup = await loadPrinterSetup();
      const result = await printKitchenOrder(order, orgName, setup);
      onResult?.(result);
    } catch {
      printKitchenTicket(order, orgName);
      onResult?.({ ok: true, usedFallback: true, printedCount: 0 });
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
        "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dash-surface-overlay px-3 text-sm font-medium text-dash-text-secondary transition hover:border-dash-text-muted hover:bg-dash-surface-raised hover:text-dash-text touch-manipulation disabled:opacity-50",
        className
      )}
    >
      <Printer className="size-4" />
      {busy ? "Printing…" : label}
      {showAutoBadge && (
        <span
          className="absolute -right-1 -top-1 rounded-full bg-dash-bg px-1 text-[10px]"
          title="Auto-printed"
        >
          🖨️
        </span>
      )}
    </button>
  );
}
