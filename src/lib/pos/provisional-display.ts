import type { ProvisionalEntry } from "@/lib/pos/provisional-merge";
import type { OrderWithDetails } from "@/types";

export type ProvisionalKdsOrder = OrderWithDetails & {
  isProvisional: true;
  clientOrderId: string;
  provisionalConflictReason?: string;
};

export function isProvisionalKdsOrder(
  order: OrderWithDetails | ProvisionalKdsOrder
): order is ProvisionalKdsOrder {
  return (
    "isProvisional" in order &&
    (order as ProvisionalKdsOrder).isProvisional === true
  );
}

export function provisionalEntryToKdsOrder(
  entry: ProvisionalEntry
): ProvisionalKdsOrder {
  const { payload } = entry;
  const createdAt = payload.createdAt;

  return {
    id: `provisional:${payload.clientOrderId}`,
    isProvisional: true,
    clientOrderId: payload.clientOrderId,
    provisionalConflictReason: entry.conflictReason,
    location_id: payload.locationId,
    table_id: payload.tableId,
    order_number: 0,
    status: "pending",
    payment_status: "pending",
    payment_method: "at_bar",
    subtotal: payload.total,
    tax_amount: 0,
    total: payload.total,
    notes: null,
    created_at: createdAt,
    updated_at: createdAt,
    accepted_at: null,
    preparing_at: null,
    ready_at: null,
    delivered_at: null,
    tables: { name: payload.tableName, zone: null },
    order_items: payload.items.map((item, index) => ({
      id: `${payload.clientOrderId}-item-${index}`,
      order_id: `provisional:${payload.clientOrderId}`,
      product_id: `provisional-product-${index}`,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: 0,
      total_price: 0,
      notes: item.notes ?? null,
      tax_rate: 0,
      tax_amount: 0,
      order_item_modifiers: [],
    })),
  } as unknown as ProvisionalKdsOrder;
}

export function mergeKdsOrdersWithProvisionals(
  serverOrders: OrderWithDetails[],
  provisionals: ProvisionalEntry[]
): Array<OrderWithDetails | ProvisionalKdsOrder> {
  const provisionalOrders = provisionals.map(provisionalEntryToKdsOrder);
  return [...provisionalOrders, ...serverOrders];
}
