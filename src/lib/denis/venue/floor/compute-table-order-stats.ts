import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";

type TableOrderSnapshot = {
  status: string;
  created_at: string;
  hasKitchenItems: boolean;
  hasDessert: boolean;
};

/** Per-table order timing stats for staff copilot actions (G2). */
export function computeTableOrderStats(input: {
  orders: TableOrderSnapshot[];
  lastGuestActivityAt: string | null;
  sessionOpenedAt: string | null;
  nowMs?: number;
}): {
  guestWaitMinutes: number | null;
  idleMinutes: number | null;
  allOrdersDelivered: boolean;
  minutesSinceLastDelivery: number | null;
} {
  const now = input.nowMs ?? Date.now();

  const kitchenActive = input.orders.filter(
    (order) =>
      order.hasKitchenItems &&
      ["pending", "accepted", "preparing"].includes(order.status)
  );

  let guestWaitMinutes: number | null = null;
  if (kitchenActive.length > 0) {
    const oldestMs = Math.min(
      ...kitchenActive.map((order) => new Date(order.created_at).getTime())
    );
    guestWaitMinutes = Math.round((now - oldestMs) / 60_000);
  }

  const hasOrders = input.orders.length > 0;
  const allOrdersDelivered =
    hasOrders && input.orders.every((order) => order.status === "delivered");

  let minutesSinceLastDelivery: number | null = null;
  if (allOrdersDelivered) {
    const lastDeliveryMs = Math.max(
      ...input.orders.map((order) => new Date(order.created_at).getTime())
    );
    minutesSinceLastDelivery = Math.round((now - lastDeliveryMs) / 60_000);
  }

  const lastActivity = input.lastGuestActivityAt ?? input.sessionOpenedAt;
  const idleMinutes = lastActivity
    ? Math.round((now - new Date(lastActivity).getTime()) / 60_000)
    : null;

  return {
    guestWaitMinutes,
    idleMinutes,
    allOrdersDelivered,
    minutesSinceLastDelivery,
  };
}

export function orderSnapshotsFromRows(
  orders: Array<{
    status: string;
    created_at: string;
    order_items?: Array<{ menu_section: string | null }>;
  }>
): TableOrderSnapshot[] {
  return orders.map((order) => ({
    status: order.status,
    created_at: order.created_at,
    hasKitchenItems: (order.order_items ?? []).some((item) =>
      isKitchenMenuSection(item.menu_section)
    ),
    hasDessert: (order.order_items ?? []).some(
      (item) => item.menu_section === "desserts"
    ),
  }));
}
