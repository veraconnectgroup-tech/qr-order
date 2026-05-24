"use client";

import { toast } from "sonner";
import { printKitchenTicket } from "@/lib/kitchen/print-ticket";
import { buildKitchenTicketEscPos } from "@/lib/printer/format-kitchen-ticket";
import { printTicket } from "@/lib/printer/print-service";
import { splitOrderItemsByTarget } from "@/lib/printer/split-items";
import type { PaperWidth } from "@/lib/printer/escpos-builder";
import type {
  PrinterConfig,
  PrinterSetup,
  PrinterTarget,
} from "@/lib/printer/types";
import type { OrderWithDetails } from "@/types";

export type KitchenPrintResult = {
  ok: boolean;
  usedFallback: boolean;
  printedCount: number;
};

function isKitchenPrinter(config: PrinterConfig) {
  return (
    config.print_for.includes("kitchen") || config.print_for.includes("bar")
  );
}

export function hasKitchenPrinters(setup: PrinterSetup) {
  return setup.configs.some(isKitchenPrinter);
}

export function hasAutoKitchenPrinters(setup: PrinterSetup) {
  return setup.configs.some(
    (config) => config.auto_print && isKitchenPrinter(config)
  );
}

function itemsForPrinter(
  split: ReturnType<typeof splitOrderItemsByTarget>,
  printFor: PrinterTarget[]
) {
  const items = [];
  if (printFor.includes("kitchen")) items.push(...split.kitchen);
  if (printFor.includes("bar")) items.push(...split.bar);
  return items;
}

function ticketHeaderLabel(printFor: PrinterTarget[]) {
  const hasKitchen = printFor.includes("kitchen");
  const hasBar = printFor.includes("bar");
  if (hasBar && !hasKitchen) return "BAR";
  return undefined;
}

export async function printKitchenOrder(
  order: OrderWithDetails,
  orgName: string,
  setup: PrinterSetup,
  options?: { silent?: boolean; autoOnly?: boolean }
): Promise<KitchenPrintResult> {
  const printers = setup.configs.filter((config) => {
    if (!isKitchenPrinter(config)) return false;
    if (options?.autoOnly && !config.auto_print) return false;
    return true;
  });

  if (printers.length === 0) {
    const usedFallback = printKitchenTicket(order, orgName);
    return { ok: usedFallback, usedFallback, printedCount: 0 };
  }

  const split = splitOrderItemsByTarget(order, setup.productTargets);
  let printedCount = 0;
  let failed = false;

  for (const printer of printers) {
    const printFor = printer.print_for as PrinterTarget[];
    const items = itemsForPrinter(split, printFor);
    if (items.length === 0) continue;

    const data = buildKitchenTicketEscPos(
      { ...order, order_items: items },
      orgName,
      printer.paper_width as PaperWidth,
      ticketHeaderLabel(printFor)
    );

    const result = await printTicket(data, printer);
    if (result.ok) {
      printedCount += 1;
    } else {
      failed = true;
    }
  }

  if (printedCount === 0 && !failed) {
    const usedFallback = printKitchenTicket(order, orgName);
    return { ok: usedFallback, usedFallback, printedCount: 0 };
  }

  if (failed) {
    if (!options?.silent) {
      toast.error("Printer offline, using browser print");
    }
    printKitchenTicket(order, orgName);
    return { ok: printedCount > 0, usedFallback: true, printedCount };
  }

  return { ok: true, usedFallback: false, printedCount };
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
