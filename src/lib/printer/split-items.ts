import type { PrinterTarget } from "@/lib/printer/types";
import type { OrderWithDetails } from "@/types";

export type OrderItemWithDetails = OrderWithDetails["order_items"][number];

export function resolveItemPrinterTarget(
  item: OrderItemWithDetails,
  productTargets: Record<string, PrinterTarget>
): Exclude<PrinterTarget, "receipt"> {
  if (item.product_id && productTargets[item.product_id]) {
    const target = productTargets[item.product_id];
    if (target === "receipt") return "kitchen";
    return target;
  }

  if (item.menu_section === "drinks") return "bar";
  return "kitchen";
}

export function splitOrderItemsByTarget(
  order: Pick<OrderWithDetails, "order_items">,
  productTargets: Record<string, PrinterTarget>
): Record<Exclude<PrinterTarget, "receipt">, OrderItemWithDetails[]> {
  const kitchen: OrderItemWithDetails[] = [];
  const bar: OrderItemWithDetails[] = [];

  for (const item of order.order_items ?? []) {
    const target = resolveItemPrinterTarget(item, productTargets);
    if (target === "bar") {
      bar.push(item);
    } else {
      kitchen.push(item);
    }
  }

  return { kitchen, bar };
}
