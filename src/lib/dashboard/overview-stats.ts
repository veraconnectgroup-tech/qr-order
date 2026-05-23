import { countsTowardRevenue, sumOrderRevenue } from "@/lib/orders/revenue";

export type OrderStatRow = {
  total: number | string;
  status: string;
  created_at?: string;
};

export function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfYesterdayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

export function sevenDayRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return { start, end };
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function computeOverviewDayStats(orders: OrderStatRow[]) {
  const active = orders.filter(
    (o) => o.status !== "rejected" && o.status !== "cancelled"
  );
  const revenueEligible = active.filter((o) => countsTowardRevenue(o.status));
  const revenue = sumOrderRevenue(active);
  const count = active.length;
  const avg =
    revenueEligible.length > 0
      ? revenue / revenueEligible.length
      : 0;

  return { revenue, count, avg };
}

export function computeSparklinePoints(orders: OrderStatRow[]) {
  const { start, end } = sevenDayRange();
  const byDay = new Map<string, number>();

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    byDay.set(cursor.toISOString().slice(0, 10), 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const order of orders) {
    if (!order.created_at || !countsTowardRevenue(order.status)) continue;
    const key = order.created_at.slice(0, 10);
    if (!byDay.has(key)) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + Number(order.total));
  }

  return Array.from(byDay.entries()).map(([date, revenue]) => ({
    date,
    revenue,
    isToday: date === new Date().toISOString().slice(0, 10),
    label: new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "short",
    }),
  }));
}
