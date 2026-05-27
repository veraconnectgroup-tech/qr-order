import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";

export type KitchenBacklogOrder = {
  status: string;
  created_at: string;
  accepted_at: string | null;
  preparing_at: string | null;
  order_items: Array<{ menu_section: string | null }>;
};

const KITCHEN_ACTIVE_STATUSES = ["pending", "accepted", "preparing"] as const;

function isKitchenActiveStatus(status: string): boolean {
  return (KITCHEN_ACTIVE_STATUSES as readonly string[]).includes(status);
}

function hasKitchenItems(order: KitchenBacklogOrder): boolean {
  return (order.order_items ?? []).some((item) =>
    isKitchenMenuSection(item.menu_section)
  );
}

function elapsedMinutesSince(
  order: KitchenBacklogOrder,
  nowMs: number
): number {
  const since =
    order.preparing_at ?? order.accepted_at ?? order.created_at;
  return Math.max(0, Math.round((nowMs - new Date(since).getTime()) / 60_000));
}

/** Average kitchen wait for active food/dessert orders (ADR-005 §5.1). */
export function computeKdsBacklogMinutes(
  orders: KitchenBacklogOrder[],
  nowMs = Date.now()
): number | null {
  const kitchenOrders = orders.filter(
    (order) =>
      isKitchenActiveStatus(order.status) && hasKitchenItems(order)
  );

  if (!kitchenOrders.length) return null;

  const total = kitchenOrders.reduce(
    (sum, order) => sum + elapsedMinutesSince(order, nowMs),
    0
  );

  return Math.round(total / kitchenOrders.length);
}
