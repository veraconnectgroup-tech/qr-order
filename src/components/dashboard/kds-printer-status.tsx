"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  hasKitchenPrinters,
  type KitchenPrintResult,
} from "@/lib/printer/print-kitchen-order";
import { loadPrinterSetup } from "@/lib/printer/load-printer-setup";
import { cn } from "@/lib/utils";

export type PrinterStatus = "none" | "connected" | "failed";

export function useKdsPrinterStatus(lastPrint: KitchenPrintResult | null) {
  const [hasPrinters, setHasPrinters] = useState<boolean | null>(null);

  useEffect(() => {
    void loadPrinterSetup().then((setup) => {
      setHasPrinters(hasKitchenPrinters(setup));
    });
  }, []);

  const status: PrinterStatus =
    hasPrinters === false
      ? "none"
      : lastPrint?.ok === false || (lastPrint?.usedFallback && lastPrint.printedCount === 0)
        ? "failed"
        : hasPrinters
          ? "connected"
          : "none";

  return { status, hasPrinters };
}

export function KdsPrinterStatus({
  status,
}: {
  status: PrinterStatus;
}) {
  const label =
    status === "connected"
      ? "Printer connected"
      : status === "failed"
        ? "Last print failed"
        : "No printer configured";

  const dotClass =
    status === "connected"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : status === "failed"
        ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
        : "bg-dash-text-muted";

  return (
    <Link
      href="/admin/settings"
      title={`${label} — open printer settings`}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-dash-surface-overlay px-3 text-sm text-dash-text-secondary transition hover:bg-dash-surface"
    >
      <span
        className={cn("size-2.5 rounded-full", dotClass)}
        aria-hidden
      />
      <span className="hidden sm:inline">Printer</span>
    </Link>
  );
}
