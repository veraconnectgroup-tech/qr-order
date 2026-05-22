import type { OrderWithDetails } from "@/types";
import { countsTowardRevenue } from "@/lib/orders/revenue";

export type DailyRevenuePoint = {
  date: string;
  revenue: number;
  orders: number;
};

export type TopItemPoint = {
  name: string;
  count: number;
};

export type HourlyPoint = {
  hour: string;
  orders: number;
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function computeDailyRevenue(
  orders: OrderWithDetails[],
  range: { start: Date; end: Date }
): DailyRevenuePoint[] {
  const byDay = new Map<string, { revenue: number; orders: number }>();

  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    byDay.set(dayKey(cursor.toISOString()), { revenue: 0, orders: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const order of orders) {
    const key = dayKey(order.created_at);
    const bucket = byDay.get(key);
    if (!bucket) continue;

    bucket.orders += 1;
    if (countsTowardRevenue(order.status)) {
      bucket.revenue += Number(order.total);
    }
  }

  return Array.from(byDay.entries()).map(([date, stats]) => ({
    date,
    revenue: stats.revenue,
    orders: stats.orders,
  }));
}

export function computeTopItems(
  orders: OrderWithDetails[],
  limit = 5
): TopItemPoint[] {
  const counts = new Map<string, number>();

  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      counts.set(
        item.product_name,
        (counts.get(item.product_name) ?? 0) + item.quantity
      );
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function computeHourlyOrders(orders: OrderWithDetails[]): HourlyPoint[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    orders: 0,
  }));

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours();
    buckets[hour].orders += 1;
  }

  return buckets;
}
