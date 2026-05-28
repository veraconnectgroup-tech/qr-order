import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderFact } from "@/lib/denis/loop/types";

type RawOrderRow = {
  id: string;
  order_number: number | null;
  status: string;
  payment_status: string;
  estimated_prep_minutes: number | null;
  created_at: string;
  order_items: Array<{ product_name: string; quantity: number }> | null;
};

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
      order_items (product_name, quantity)
    `
    )
    .eq("session_id", tableSessionId)
    .not("status", "in", '("rejected","cancelled")')
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((orders ?? []) as unknown as RawOrderRow[]).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    estimatedPrepMinutes: order.estimated_prep_minutes,
    createdAt: order.created_at,
    items: (order.order_items ?? []).map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
    })),
  }));
}

/** Pure helper — eval fixture entry (order visible in MIND). */
export function orderFactsFromSubmit(input: {
  orderId: string;
  orderNumber: number;
  items: Array<{ productName: string; quantity: number }>;
}): OrderFact[] {
  return [
    {
      id: input.orderId,
      orderNumber: input.orderNumber,
      status: "pending",
      paymentStatus: "unpaid",
      estimatedPrepMinutes: null,
      createdAt: new Date().toISOString(),
      items: input.items,
    },
  ];
}
