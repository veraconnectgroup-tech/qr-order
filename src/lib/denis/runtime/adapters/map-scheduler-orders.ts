import type { AiGuestOrder } from "@/lib/ai/order-context";
import type { SchedulerOrderSnapshot } from "@/lib/denis/kernel/scheduler/types";

export function mapGuestOrdersToSchedulerSnapshot(
  orders: AiGuestOrder[]
): SchedulerOrderSnapshot[] {
  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.created_at,
    delivered_at: order.delivered_at,
    order_items: order.order_items.map((item) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      menu_section: item.menu_section,
    })),
  }));
}
