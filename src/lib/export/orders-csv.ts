import { escapeCsvField } from "@/lib/security/escape";
import type { OrderWithDetails } from "@/types";

type OrderCsvRow = OrderWithDetails & {
  table_sessions?: { guest_email: string | null } | null;
};

function formatItems(order: OrderCsvRow) {
  return (order.order_items ?? [])
    .map((item) => {
      const mods =
        item.order_item_modifiers
          ?.map((m) => m.modifier_name)
          .filter(Boolean)
          .join(", ") ?? "";
      const base = `${item.quantity}x ${item.product_name}`;
      return mods ? `${base} (${mods})` : base;
    })
    .join("; ");
}

function formatSource(source: string | undefined) {
  if (source === "staff") return "staff";
  if (source === "pos") return "pos";
  if (source === "kiosk") return "guest";
  return "guest";
}

function formatPaymentMethod(method: string | undefined) {
  if (method === "online") return "online";
  if (method === "card_at_table") return "card_at_table";
  if (method === "at_bar") return "at_bar";
  return method ?? "";
}

export function ordersToCsv(orders: OrderCsvRow[]) {
  const header = [
    "order_number",
    "date",
    "time",
    "table",
    "items",
    "subtotal",
    "tax",
    "tip",
    "total",
    "payment_method",
    "status",
    "source",
    "email",
  ].join(",");

  const rows = orders.map((order) => {
    const created = new Date(order.created_at);
    const date = created.toLocaleDateString("de-DE");
    const time = created.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return [
      order.order_number,
      date,
      time,
      order.tables?.name ?? "",
      formatItems(order),
      Number(order.subtotal).toFixed(2),
      Number(order.tax_amount).toFixed(2),
      Number(order.tip_amount ?? 0).toFixed(2),
      Number(order.total).toFixed(2),
      formatPaymentMethod(order.payment_method),
      order.status,
      formatSource(order.order_source),
      order.table_sessions?.guest_email ?? "",
    ]
      .map((value) => escapeCsvField(String(value ?? "")))
      .join(",");
  });

  return [header, ...rows].join("\n");
}

export function ordersCsvFilename(from: string, to: string) {
  return `orders-${from}-${to}.csv`;
}
