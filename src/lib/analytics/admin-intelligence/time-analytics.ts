import type { AdminAnalyticsOrder } from "@/lib/analytics/admin-analytics";
import type {
  StaffSchedulingSuggestion,
  TimeAnalyticsSnapshot,
  TimeSeriesPoint,
} from "@/lib/analytics/admin-intelligence/types";
import { countsTowardRevenue } from "@/lib/orders/revenue";

const ORDERS_PER_WAITER_PER_HOUR = 4;

function weekStartKey(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildHourlySeries(orders: AdminAnalyticsOrder[]): TimeSeriesPoint[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    revenue: 0,
    orders: 0,
  }));

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours();
    buckets[hour].orders += 1;
    if (countsTowardRevenue(order.status)) {
      buckets[hour].revenue += Number(order.total);
    }
  }

  return buckets;
}

function buildDailySeries(
  orders: AdminAnalyticsOrder[],
  from: Date,
  to: Date
): TimeSeriesPoint[] {
  const buckets = new Map<string, TimeSeriesPoint>();
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.set(key, {
      label: cursor.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      revenue: 0,
      orders: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const order of orders) {
    const key = order.created_at.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (countsTowardRevenue(order.status)) {
      bucket.revenue += Number(order.total);
    }
  }

  return [...buckets.values()];
}

function buildWeeklySeries(orders: AdminAnalyticsOrder[]): TimeSeriesPoint[] {
  const buckets = new Map<string, TimeSeriesPoint>();

  for (const order of orders) {
    const key = weekStartKey(new Date(order.created_at));
    const bucket = buckets.get(key) ?? {
      label: new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      revenue: 0,
      orders: 0,
    };
    bucket.orders += 1;
    if (countsTowardRevenue(order.status)) {
      bucket.revenue += Number(order.total);
    }
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

function buildMonthlySeries(orders: AdminAnalyticsOrder[]): TimeSeriesPoint[] {
  const buckets = new Map<string, TimeSeriesPoint>();

  for (const order of orders) {
    const key = monthKey(new Date(order.created_at));
    const bucket = buckets.get(key) ?? {
      label: new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      }),
      revenue: 0,
      orders: 0,
    };
    bucket.orders += 1;
    if (countsTowardRevenue(order.status)) {
      bucket.revenue += Number(order.total);
    }
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

export function suggestStaffScheduling(input: {
  orders: AdminAnalyticsOrder[];
  currentWaiterCount: number;
}): StaffSchedulingSuggestion[] {
  const byDayHour = new Map<
    string,
    { day: number; hour: number; orders: number }
  >();

  for (const order of input.orders) {
    const created = new Date(order.created_at);
    const day = created.getDay();
    const hour = created.getHours();
    const key = `${day}:${hour}`;
    const bucket = byDayHour.get(key) ?? { day, hour, orders: 0 };
    bucket.orders += 1;
    byDayHour.set(key, bucket);
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const suggestions: StaffSchedulingSuggestion[] = [];

  for (const bucket of byDayHour.values()) {
    const suggested = Math.max(
      1,
      Math.ceil(bucket.orders / ORDERS_PER_WAITER_PER_HOUR)
    );
    if (suggested <= input.currentWaiterCount) continue;

    suggestions.push({
      dayLabel: dayNames[bucket.day] ?? "Day",
      hourRange: `${String(bucket.hour).padStart(2, "0")}:00–${String(
        Math.min(23, bucket.hour + 3)
      ).padStart(2, "0")}:00`,
      suggestedWaiters: suggested,
      currentWaiters: input.currentWaiterCount,
      reason: `${dayNames[bucket.day]} ${String(bucket.hour).padStart(2, "0")}:00–${String(
        Math.min(23, bucket.hour + 3)
      ).padStart(2, "0")}:00 needs ${suggested} waiters, you have ${input.currentWaiterCount}`,
    });
  }

  return suggestions
    .sort(
      (a, b) =>
        b.suggestedWaiters - b.currentWaiters - (a.suggestedWaiters - a.currentWaiters)
    )
    .slice(0, 5);
}

export function buildTimeAnalytics(input: {
  orders: AdminAnalyticsOrder[];
  from: Date;
  to: Date;
  currentWaiterCount: number;
}): TimeAnalyticsSnapshot {
  const byHour = buildHourlySeries(input.orders);
  const hourRanked = byHour
    .map((row) => ({
      hour: row.label,
      orders: row.orders,
      revenue: row.revenue,
    }))
    .filter((row) => row.orders > 0);

  const busiestHours = [...hourRanked]
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 3);
  const slowestHours = [...hourRanked]
    .sort((a, b) => a.orders - b.orders)
    .slice(0, 3);

  return {
    byHour,
    byDay: buildDailySeries(input.orders, input.from, input.to),
    byWeek: buildWeeklySeries(input.orders),
    byMonth: buildMonthlySeries(input.orders),
    busiestHours,
    slowestHours,
    staffSuggestions: suggestStaffScheduling({
      orders: input.orders,
      currentWaiterCount: input.currentWaiterCount,
    }),
  };
}
