import { formatOrderNumber } from "@/lib/format";
import {
  EscPosBuilder,
  type PaperWidth,
  separatorLine,
} from "@/lib/printer/escpos-builder";
import type { OrderWithDetails } from "@/types";

type KitchenTicketItem = OrderWithDetails["order_items"][number];

export function buildKitchenTicketEscPos(
  order: Pick<OrderWithDetails, "order_number" | "created_at" | "notes"> & {
    tables?: OrderWithDetails["tables"];
    order_items: KitchenTicketItem[];
  },
  orgName: string,
  paperWidth: PaperWidth = 80,
  headerLabel?: string
): Uint8Array {
  const tableName = order.tables?.name ?? "—";
  const time = new Date(order.created_at ?? Date.now()).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const items = order.order_items;
  const builder = new EscPosBuilder().initialize();

  builder
    .align("left")
    .bold(true)
    .textSize(2, 2)
    .text(formatOrderNumber(order.order_number))
    .newline()
    .bold(false)
    .textSize(1, 1);

  if (headerLabel) {
    builder.text(headerLabel).newline();
  }

  builder
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
