import type { PrinterTarget } from "@/lib/printer/types";
import { splitOrderItemsByTarget } from "@/lib/printer/split-items";
import type { OrderWithDetails } from "@/types";

export type KitchenStationLabel = "KUHINJA" | "BAR";

export type PlannedKitchenPrintJob = {
  printerId: string;
  stationLabel: KitchenStationLabel;
  itemCount: number;
};

export type PrinterRoutingConfig = {
  id: string;
  print_for: PrinterTarget[];
};

export function resolveKitchenStationLabel(
  printFor: PrinterTarget[]
): KitchenStationLabel | undefined {
  const hasKitchen = printFor.includes("kitchen");
  const hasBar = printFor.includes("bar");
  if (hasKitchen && !hasBar) return "KUHINJA";
  if (hasBar && !hasKitchen) return "BAR";
  if (hasKitchen && hasBar) return "KUHINJA";
  return undefined;
}

export function planKitchenPrintJobs(input: {
  order: Pick<OrderWithDetails, "order_items">;
  productTargets: Record<string, PrinterTarget>;
  printers: PrinterRoutingConfig[];
}): PlannedKitchenPrintJob[] {
  const split = splitOrderItemsByTarget(input.order, input.productTargets);
  const jobs: PlannedKitchenPrintJob[] = [];

  for (const printer of input.printers) {
    const printFor = printer.print_for;
    const isKitchenLike =
      printFor.includes("kitchen") || printFor.includes("bar");
    if (!isKitchenLike) continue;

    const items = [
      ...(printFor.includes("kitchen") ? split.kitchen : []),
      ...(printFor.includes("bar") ? split.bar : []),
    ];
    if (items.length === 0) continue;

    const stationLabel = resolveKitchenStationLabel(printFor);
    if (!stationLabel) continue;

    jobs.push({
      printerId: printer.id,
      stationLabel,
      itemCount: items.length,
    });
  }

  return jobs;
}

export function countExpectedKitchenTickets(input: {
  order: Pick<OrderWithDetails, "order_items">;
  productTargets: Record<string, PrinterTarget>;
  printers: PrinterRoutingConfig[];
}): number {
  const split = splitOrderItemsByTarget(input.order, input.productTargets);
  let count = 0;
  const hasKitchenItems = split.kitchen.length > 0;
  const hasBarItems = split.bar.length > 0;

  for (const printer of input.printers) {
    const printFor = printer.print_for;
    const items = [
      ...(printFor.includes("kitchen") ? split.kitchen : []),
      ...(printFor.includes("bar") ? split.bar : []),
    ];
    if (items.length > 0) count += 1;
  }

  if (count === 0 && (hasKitchenItems || hasBarItems)) {
    return (hasKitchenItems ? 1 : 0) + (hasBarItems ? 1 : 0);
  }

  return count;
}
