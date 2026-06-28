"use client";

import { toast } from "sonner";
import { buildReceiptEscPos } from "@/lib/printer/format-receipt";
import type { PaperWidth } from "@/lib/printer/escpos-builder";
import { printTicket } from "@/lib/printer/print-service";
import type { PrinterSetup } from "@/lib/printer/types";
import type { OrderWithDetails } from "@/types";

export async function printReceiptOrder(
  order: OrderWithDetails,
  orgName: string,
  currency: string,
  setup: PrinterSetup,
  options?: {
    silent?: boolean;
    logoUrl?: string | null;
    footerMessage?: string;
    poweredByLabel?: string;
    hidePoweredBy?: boolean;
  }
): Promise<boolean> {
  const receiptPrinters = setup.configs.filter((config) =>
    config.print_for.includes("receipt")
  );

  if (receiptPrinters.length === 0) {
    if (!options?.silent) {
      toast.error("No receipt printer configured.");
    }
    return false;
  }

  const printer = receiptPrinters[0];
  const data = buildReceiptEscPos(
    order,
    { name: orgName, logo_url: options?.logoUrl ?? null },
    setup.location,
    printer.paper_width as PaperWidth,
    currency,
    {
      logoUrl: options?.logoUrl ?? null,
      footerMessage: options?.footerMessage,
      poweredByLabel: options?.poweredByLabel,
      hidePoweredBy: options?.hidePoweredBy,
    }
  );

  for (const candidate of receiptPrinters) {
    const result = await printTicket(data, candidate);
    if (result.ok) return true;
  }

  if (!options?.silent) {
    toast.error("Receipt printer offline.");
  }
  return false;
}

export async function reprintReceiptOrder(
  order: OrderWithDetails,
  orgName: string,
  currency: string,
  setup: PrinterSetup
): Promise<boolean> {
  return printReceiptOrder(order, orgName, currency, setup);
}
