import type { OrderWithDetails } from "@/types";

type OrderItemRow = OrderWithDetails["order_items"][number];

export type GroupedOrderItemLine = {
  key: string;
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  notes: string | null;
  modifiers: Array<{ id: string; modifier_name: string }>;
};

function modifierSignature(
  modifiers: OrderItemRow["order_item_modifiers"] | undefined
): string {
  return [...(modifiers ?? [])]
    .map((m) => m.modifier_id ?? m.modifier_name)
    .sort()
    .join("|");
}

function groupingKey(item: OrderItemRow): string {
  const notes = (item.notes ?? "").trim();
  return [
    item.product_id ?? item.product_name,
    notes,
    modifierSignature(item.order_item_modifiers),
  ].join("\0");
}

/** Merge identical line items (same product, notes, modifiers) for staff display. */
export function groupOrderItemsForDisplay(
  items: OrderItemRow[] | null | undefined
): GroupedOrderItemLine[] {
  const grouped = new Map<string, GroupedOrderItemLine>();

  for (const item of items ?? []) {
    const key = groupingKey(item);
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    const mods = [...(item.order_item_modifiers ?? [])].sort((a, b) =>
      a.modifier_name.localeCompare(b.modifier_name, undefined, {
        sensitivity: "base",
      })
    );

    grouped.set(key, {
      key,
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      notes: item.notes,
      modifiers: mods.map((m) => ({
        id: m.id,
        modifier_name: m.modifier_name,
      })),
    });
  }

  return Array.from(grouped.values());
}
