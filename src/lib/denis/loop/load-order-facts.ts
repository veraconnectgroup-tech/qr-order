import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderFact } from "@/lib/denis/loop/types";
import { parseOrderFactRows } from "@/lib/supabase/parse-order-rows";

function lineTotalCents(total: number | string): number {
  const value = typeof total === "string" ? Number.parseFloat(total) : total;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100));
}

/** Order Core rows for a table session — read-only TRUTH input. */
export async function loadOrderFactsForSession(
  admin: SupabaseClient,
  tableSessionId: string
): Promise<OrderFact[]> {
  const { data: orders, error } = await admin
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      payment_status,
      estimated_prep_minutes,
      created_at,
      order_source,
      order_items (id, product_id, product_name, quantity, total)
    `
    )
    .eq("session_id", tableSessionId)
    .not("status", "in", '("rejected","cancelled")')
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return parseOrderFactRows(orders).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    estimatedPrepMinutes: order.estimated_prep_minutes,
    createdAt: order.created_at,
    orderSource: order.order_source ?? null,
    items: (order.order_items ?? []).map((item) => ({
      orderItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      lineTotalCents: lineTotalCents(item.total),
    })),
  }));
}

/** Pure helper — eval fixture entry (order visible in MIND). */
export function orderFactsFromSubmit(input: {
  orderId: string;
  orderNumber: number;
  items: Array<{
    productId?: string | null;
    productName: string;
    quantity: number;
    lineTotalCents?: number;
  }>;
}): OrderFact[] {
  return [
    {
      id: input.orderId,
      orderNumber: input.orderNumber,
      status: "pending",
      paymentStatus: "unpaid",
      estimatedPrepMinutes: null,
      createdAt: new Date().toISOString(),
      items: input.items.map((item) => ({
        orderItemId: undefined,
        productId: item.productId ?? null,
        productName: item.productName,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents ?? 0,
      })),
    },
  ];
}
