import type { FloorTableHint } from "@/lib/denis/venue/floor/types";

type TableOrderSnapshot = {
  status: string;
  created_at: string;
  hasKitchenItems: boolean;
  hasDessert: boolean;
};

/** Lightweight per-table hint for staff copilot (M14). */
export function deriveTableOperatingHint(input: {
  sessionOpenedAt: string | null;
  orders: TableOrderSnapshot[];
  lastGuestActivityAt: string | null;
  backlogThresholdMinutes: number;
  nowMs?: number;
}): FloorTableHint {
  const now = input.nowMs ?? Date.now();

  if (!input.sessionOpenedAt) return null;

  const seatedMinutes = Math.round(
    (now - new Date(input.sessionOpenedAt).getTime()) / 60_000
  );

  const kitchenActive = input.orders.filter(
    (order) =>
      order.hasKitchenItems &&
      ["pending", "accepted", "preparing"].includes(order.status)
  );

  const lateKitchen = kitchenActive.some((order) => {
    const since = new Date(order.created_at).getTime();
    return (now - since) / 60_000 >= input.backlogThresholdMinutes;
  });

  if (lateKitchen) return "needs_attention";

  const hasDeliveredFood = input.orders.some(
    (order) => order.status === "delivered" && order.hasKitchenItems
  );
  const hasDessert = input.orders.some((order) => order.hasDessert);

  if (hasDeliveredFood && !hasDessert && seatedMinutes >= 45) {
    return "ready_for_dessert";
  }

  const lastActivity = input.lastGuestActivityAt ?? input.sessionOpenedAt;
  const idleMinutes = (now - new Date(lastActivity).getTime()) / 60_000;

  if (
    input.orders.length === 0 &&
    seatedMinutes >= 10 &&
    idleMinutes >= 15
  ) {
    return "idle";
  }

  return null;
}
