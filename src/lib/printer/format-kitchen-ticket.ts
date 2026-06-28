import { formatOrderNumber } from "@/lib/format";
import { buildKdsFulfillmentLabel, orderModeFromLegacy } from "@/lib/denis/commerce/delivery-mode";
import {
  EscPosBuilder,
  type PaperWidth,
  separatorLine,
  wrapText,
} from "@/lib/printer/escpos-builder";
import type { OrderWithDetails } from "@/types";

type KitchenTicketItem = OrderWithDetails["order_items"][number];

export type KitchenTicketOptions = {
  headerLabel?: string;
  allergyLabels?: string[];
  isTakeaway?: boolean;
};

export function formatAllergyBanner(labels: string[]): string {
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => label.toUpperCase())
    .join(" · ");
}

export function buildKitchenTicketEscPos(
  order: Pick<
    OrderWithDetails,
    "order_number" | "created_at" | "notes" | "is_takeaway"
  > & {
    tables?: OrderWithDetails["tables"];
    order_items: KitchenTicketItem[];
  },
  orgName: string,
  paperWidth: PaperWidth = 80,
  headerLabel?: string,
  options: KitchenTicketOptions = {}
): Uint8Array {
  const tableName = order.tables?.name ?? "—";
  const time = new Date(order.created_at ?? Date.now()).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const items = order.order_items;
  const station = headerLabel ?? options.headerLabel;
  const allergies = options.allergyLabels ?? [];
  const takeawayLabel = order.is_takeaway
    ? buildKdsFulfillmentLabel(orderModeFromLegacy(true))
    : null;

  const builder = new EscPosBuilder().initialize();

  builder
    .align("left")
    .bold(true)
    .textSize(2, 2)
    .text(formatOrderNumber(order.order_number))
    .newline()
    .bold(false)
    .textSize(1, 1);

  if (station) {
    builder.bold(true).text(station).newline().bold(false);
  }

  if (takeawayLabel) {
    builder.bold(true).text(takeawayLabel).newline().bold(false);
  }

  builder
    .text(`${orgName} · ${tableName} · ${time}`)
    .newline()
    .text(separatorLine(paperWidth))
    .newline();

  if (allergies.length > 0) {
    const banner = formatAllergyBanner(allergies);
    builder.bold(true).text(`⚠ ALLERGIE: ${banner}`).newline().bold(false);
    builder.text(separatorLine(paperWidth, "!")).newline();
  }

  for (const item of items) {
    builder.bold(true).text(`${item.quantity}× ${item.product_name}`).newline().bold(false);

    for (const mod of item.order_item_modifiers ?? []) {
      builder.text(`   → ${mod.modifier_name}`).newline();
    }

    if (item.notes) {
      builder.text(`   → NOTE: ${item.notes}`).newline();
    }
  }

  builder.text(separatorLine(paperWidth)).newline();

  if (order.notes) {
    for (const line of wrapText(`Order note: ${order.notes}`, paperWidth)) {
      builder.text(line).newline();
    }
  }

  builder.newline().cut();

  return builder.build();
}
