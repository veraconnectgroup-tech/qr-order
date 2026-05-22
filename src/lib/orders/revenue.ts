const REVENUE_STATUSES = new Set([
  "accepted",
  "preparing",
  "ready",
  "delivered",
]);

export function countsTowardRevenue(status: string) {
  return REVENUE_STATUSES.has(status);
}

export function sumOrderRevenue(
  orders: Array<{ status: string; total: number | string }>
) {
  return orders
    .filter((o) => countsTowardRevenue(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0);
}

export function revenueEligibleOrders<T extends { status: string }>(
  orders: T[]
) {
  return orders.filter((o) => countsTowardRevenue(o.status));
}
