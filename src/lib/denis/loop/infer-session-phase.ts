import type { SessionPhase } from "@/lib/scene/types";

export type SessionPhaseOrder = {
  status: string;
  createdAt: string;
  deliveredAt?: string | null;
  items: Array<{ menuSection?: string | null }>;
};

const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled"] as const;

const KITCHEN_OPEN_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "preparing",
  "ready",
] as const;

const FOOD_SECTIONS = ["food", "desserts"] as const;

function isTerminalOrderStatus(status: string): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

function isKitchenOpenStatus(status: string): boolean {
  return (KITCHEN_OPEN_STATUSES as readonly string[]).includes(status);
}

function isFoodSection(section: string | null | undefined): boolean {
  if (!section) return false;
  return (FOOD_SECTIONS as readonly string[]).includes(section);
}

export function minutesSinceLastFoodDelivery(
  orders: SessionPhaseOrder[],
  nowMs = Date.now()
): number | null {
  let latestMs: number | null = null;

  for (const order of orders) {
    if (order.status !== "delivered") continue;
    const hasFood = order.items.some((item) => isFoodSection(item.menuSection));
    if (!hasFood) continue;

    const deliveredRef = order.deliveredAt ?? order.createdAt;
    const ts = new Date(deliveredRef).getTime();
    if (!Number.isFinite(ts)) continue;
    if (latestMs == null || ts > latestMs) latestMs = ts;
  }

  if (latestMs == null) return null;
  return Math.max(0, Math.floor((nowMs - latestMs) / 60_000));
}

export function isEatingPhaseWindow(
  orders: SessionPhaseOrder[],
  nowMs = Date.now(),
  maxMinutesSinceDelivery = 30
): boolean {
  if (orders.length === 0) return false;

  const hasOpenOrders = orders.some((order) => !isTerminalOrderStatus(order.status));
  if (hasOpenOrders) return false;

  const minutes = minutesSinceLastFoodDelivery(orders, nowMs);
  if (minutes == null) return false;
  return minutes < maxMinutesSinceDelivery;
}

/** Journey phase from commerce facts — QR scan through payment. */
export function inferSessionPhaseFromCommerce(input: {
  sessionClosed: boolean;
  billSettled: boolean;
  hasCartActivity: boolean;
  orders: SessionPhaseOrder[];
  nowMs?: number;
}): SessionPhase {
  const nowMs = input.nowMs ?? Date.now();

  if (input.sessionClosed) return "closed";
  if (input.billSettled) return "settling";

  const hasOpenKitchenOrders = input.orders.some((order) =>
    isKitchenOpenStatus(order.status)
  );
  if (hasOpenKitchenOrders) return "waiting";
  if (input.hasCartActivity) return "ordering";

  if (isEatingPhaseWindow(input.orders, nowMs)) {
    return "eating";
  }

  const allOrdersDelivered =
    input.orders.length > 0 &&
    input.orders.every((order) => order.status === "delivered");
  if (allOrdersDelivered) return "settling";

  return "browsing";
}

/** Guest on entrance waitlist QR — pre-table Denis phase. */
export function deriveWaitlistSessionPhase(onWaitlist: boolean): SessionPhase {
  return onWaitlist ? "waitlist" : "browsing";
}

/** Legacy boolean API — kept for scene loader without full order rows. */
export function deriveSessionPhase(input: {
  sessionClosed: boolean;
  hasOpenKitchenOrders: boolean;
  hasCartActivity: boolean;
  billSettled: boolean;
  allOrdersDelivered: boolean;
  orders?: SessionPhaseOrder[];
  nowMs?: number;
}): SessionPhase {
  if (input.orders?.length) {
    return inferSessionPhaseFromCommerce({
      sessionClosed: input.sessionClosed,
      billSettled: input.billSettled,
      hasCartActivity: input.hasCartActivity,
      orders: input.orders,
      nowMs: input.nowMs,
    });
  }

  if (input.sessionClosed) return "closed";
  if (input.billSettled || (input.allOrdersDelivered && !input.hasOpenKitchenOrders)) {
    return "settling";
  }
  if (input.hasOpenKitchenOrders) return "waiting";
  if (input.hasCartActivity) return "ordering";
  return "browsing";
}
