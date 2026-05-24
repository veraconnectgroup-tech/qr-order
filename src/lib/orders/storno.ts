import type { OrderWithDetails } from "@/types";

const STORNO_STATUSES = new Set([
  "accepted",
  "preparing",
  "ready",
  "delivered",
]);

export function canStornoOrder(
  order: Pick<OrderWithDetails, "status">,
  staffRole: string
): boolean {
  if (order.status === "cancelled" || order.status === "rejected") {
    return false;
  }

  if (!STORNO_STATUSES.has(order.status)) {
    return false;
  }

  if (order.status === "delivered") {
    return ["owner", "manager"].includes(staffRole);
  }

  return ["owner", "manager", "staff"].includes(staffRole);
}
