import { countsTowardRevenue } from "@/lib/orders/revenue";

export type PeakHourBucket = {
  hour: number;
  orderCount: number;
  revenue: number;
  intensity: number;
};

export function computePeakHoursHeatmap(
  orders: Array<{ total: number | string; status: string; created_at: string }>
): PeakHourBucket[] {
  const buckets: PeakHourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orderCount: 0,
    revenue: 0,
    intensity: 0,
  }));

  for (const order of orders) {
    if (!order.created_at || !countsTowardRevenue(order.status)) continue;
    const hour = new Date(order.created_at).getHours();
    buckets[hour].orderCount += 1;
    buckets[hour].revenue += Number(order.total);
  }

  const maxRevenue = Math.max(1, ...buckets.map((bucket) => bucket.revenue));
  return buckets.map((bucket) => ({
    ...bucket,
    intensity: bucket.revenue / maxRevenue,
  }));
}

export function formatPeakHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
