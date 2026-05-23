import { formatOrderNumber } from "@/lib/format";
import { getKitchenOrderItems } from "@/lib/kitchen/menu-section";
import {
  EscPosBuilder,
  type PaperWidth,
  separatorLine,
} from "@/lib/printer/escpos-builder";
import type { OrderWithDetails } from "@/types";

export function buildKitchenTicketEscPos(
  order: OrderWithDetails,
  orgName: string,
  paperWidth: PaperWidth = 80
): Uint8Array {
  const tableName = order.tables?.name ?? "—";
  const time = new Date(order.created_at).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const items = getKitchenOrderItems(order);
  const builder = new EscPosBuilder().initialize();

  builder
    .align("left")
    .bold(true)
    .textSize(2, 2)
    .text(formatOrderNumber(order.order_number))
    .newline()
    .bold(false)
    .textSize(1, 1)
    .text(`${orgName} · ${tableName} · ${time}`)
    .newline()
    .text(separatorLine(paperWidth))
    .newline();

  for (const item of items) {
    builder.text(`${item.quantity}× ${item.product_name}`).newline();

    for (const mod of item.order_item_modifiers ?? []) {
      builder.text(`   → ${mod.modifier_name}`).newline();
    }

    if (item.notes) {
      builder.text(`   → NOTE: ${item.notes}`).newline();
    }
  }

  builder.text(separatorLine(paperWidth)).newline();

  if (order.notes) {
    builder.text(`Order note: ${order.notes}`).newline();
  }

  builder.newline().cut();

  return builder.build();
}
