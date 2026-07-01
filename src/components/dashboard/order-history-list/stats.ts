import {
  revenueEligibleOrders,
  sumOrderRevenue,
} from "@/lib/orders/revenue";
import type { OrderWithDetails } from "@/types";

export type PeriodStats = {
  revenue: number;
  count: number;
  avg: number;
  topItem: string;
  topCount: number;
};

export function getPreviousRange(range: { start: Date; end: Date }) {
  const durationMs = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

export function computeStats(orders: OrderWithDetails[]): PeriodStats {
  const eligible = revenueEligibleOrders(orders);
  const revenue = sumOrderRevenue(orders);
  const avg = eligible.length ? revenue / eligible.length : 0;

  const itemCounts = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.order_items ?? []) {
      itemCounts.set(
        item.product_name,
        (itemCounts.get(item.product_name) ?? 0) + item.quantity
      );
    }
  }

  let topItem = "—";
  let topCount = 0;
  itemCounts.forEach((count, name) => {
    if (count > topCount) {
      topCount = count;
      topItem = name;
    }
  });

  return { revenue, count: orders.length, avg, topItem, topCount };
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
