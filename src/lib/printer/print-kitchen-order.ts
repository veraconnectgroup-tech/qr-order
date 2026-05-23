"use client";

import { toast } from "sonner";
import { printKitchenTicket } from "@/lib/kitchen/print-ticket";
import { buildKitchenTicketEscPos } from "@/lib/printer/format-kitchen-ticket";
import { printTicket } from "@/lib/printer/print-service";
import { splitOrderItemsByTarget } from "@/lib/printer/split-items";
import type { PaperWidth } from "@/lib/printer/escpos-builder";
import type { PrinterConfig, PrinterSetup, PrinterTarget } from "@/lib/printer/types";
import type { OrderWithDetails } from "@/types";

function printersForTarget(
  configs: PrinterConfig[],
  target: Exclude<PrinterTarget, "receipt">
) {
  return configs.filter((config) => config.print_for.includes(target));
}

async function printToFirstAvailable(
  data: Uint8Array,
  printers: PrinterConfig[]
): Promise<{ ok: boolean; error?: string }> {
  for (const printer of printers) {
    const result = await printTicket(data, printer);
    if (result.ok) return result;
  }

  return {
    ok: false,
    error: printers[0]
      ? "All configured printers failed."
      : "No printer configured for this ticket.",
  };
}

export async function printKitchenOrder(
  order: OrderWithDetails,
  orgName: string,
  setup: PrinterSetup,
  options?: { silent?: boolean }
): Promise<boolean> {
  const relevantPrinters = setup.configs.filter(
    (config) =>
      config.print_for.includes("kitchen") || config.print_for.includes("bar")
  );

  if (relevantPrinters.length === 0) {
    return printKitchenTicket(order, orgName);
  }

  const { kitchen, bar } = splitOrderItemsByTarget(order, setup.productTargets);
  let failed = false;

  if (kitchen.length > 0) {
    const kitchenPrinters = printersForTarget(setup.configs, "kitchen");
    if (kitchenPrinters.length === 0) {
      failed = true;
    } else {
      const paperWidth = kitchenPrinters[0].paper_width as PaperWidth;
      const data = buildKitchenTicketEscPos(
        { ...order, order_items: kitchen },
        orgName,
        paperWidth
      );
      const result = await printToFirstAvailable(data, kitchenPrinters);
      if (!result.ok) failed = true;
    }
  }

  if (bar.length > 0) {
    const barPrinters = printersForTarget(setup.configs, "bar");
    if (barPrinters.length === 0) {
      failed = true;
    } else {
      const paperWidth = barPrinters[0].paper_width as PaperWidth;
      const data = buildKitchenTicketEscPos(
        { ...order, order_items: bar },
        orgName,
        paperWidth,
        "BAR"
      );
      const result = await printToFirstAvailable(data, barPrinters);
      if (!result.ok) failed = true;
    }
  }

  if (kitchen.length === 0 && bar.length === 0) {
    return printKitchenTicket(order, orgName);
  }

  if (failed) {
    if (!options?.silent) {
      toast.error("Printer offline, using browser print");
    }
    printKitchenTicket(order, orgName);
    return false;
  }

  return true;
}

export async function printTestTicket(
  printer: PrinterConfig,
  setup: PrinterSetup
): Promise<boolean> {
  const { buildTestTicketEscPos } = await import(
    "@/lib/printer/build-test-ticket"
  );
  const data = buildTestTicketEscPos(
    printer.name,
    printer.paper_width as PaperWidth
  );
  const result = await printTicket(data, printer);

  if (!result.ok) {
    toast.error(result.error ?? "Test print failed.");
    return false;
  }

  toast.success("Test ticket sent.");
  void setup;
  return true;
}
