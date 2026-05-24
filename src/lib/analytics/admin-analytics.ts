import type { AnalyticsDateRange } from "@/lib/analytics/date-range";
import { rangeDurationDays } from "@/lib/analytics/date-range";
import { requireAdmin, getStaffLocationId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminAnalyticsOrder = {
  id: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  order_source: "qr" | "staff" | "kiosk" | "pos";
  created_at: string;
  order_items: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    total: number;
  }>;
};

export type RevenueSeriesPoint = {
  label: string;
  revenue: number;
};

export type TopItemRow = {
  rank: number;
  name: string;
  quantity: number;
  revenue: number;
};

export type HourlyOrdersPoint = {
  hour: string;
  orders: number;
};

export type PaymentMethodSlice = {
  key: string;
  name: string;
  total: number;
  percent: number;
};

export type OrderSourceSlice = {
  key: "qr" | "staff" | "kiosk" | "pos";
  name: string;
  count: number;
  percent: number;
};

export type AdminKpiSnapshot = {
  revenue: number;
  revenueChangePct: number;
  ordersCount: number;
  ordersChangePct: number;
  avgTicket: number;
  avgTicketChangePct: number;
};

export type AdminAnalyticsSnapshot = {
  kpis: AdminKpiSnapshot;
  revenueSeries: RevenueSeriesPoint[];
  topItems: TopItemRow[];
  hourlyOrders: HourlyOrdersPoint[];
  paymentMethods: PaymentMethodSlice[];
  orderSources: OrderSourceSlice[];
};

const PAYMENT_LABELS: Record<string, string> = {
  online: "Online",
  at_bar: "Cash (bar)",
  card_at_table: "Card at table",
};

const ORDER_SOURCE_LABELS: Record<OrderSourceSlice["key"], string> = {
  qr: "QR orders",
  staff: "Staff orders",
  kiosk: "Kiosk",
  pos: "POS orders",
};

const PAYMENT_METHOD_KEYS = ["online", "at_bar", "card_at_table"] as const;

function paidOrders(orders: AdminAnalyticsOrder[]) {
  return orders.filter((o) => o.payment_status === "paid");
}

function sumPaidRevenue(orders: AdminAnalyticsOrder[]) {
  return paidOrders(orders).reduce((sum, o) => sum + Number(o.total), 0);
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function computeKpis(
  orders: AdminAnalyticsOrder[],
  previousOrders: AdminAnalyticsOrder[]
): AdminKpiSnapshot {
  const revenue = sumPaidRevenue(orders);
  const prevRevenue = sumPaidRevenue(previousOrders);
  const ordersCount = orders.length;
  const prevOrdersCount = previousOrders.length;
  const paidOrdersCount = paidOrders(orders).length;
  const prevPaidOrdersCount = paidOrders(previousOrders).length;
  const avgTicket = paidOrdersCount > 0 ? revenue / paidOrdersCount : 0;
  const prevAvgTicket =
    prevPaidOrdersCount > 0 ? prevRevenue / prevPaidOrdersCount : 0;

  return {
    revenue,
    revenueChangePct: pctChange(revenue, prevRevenue),
    ordersCount,
    ordersChangePct: pctChange(ordersCount, prevOrdersCount),
    avgTicket,
    avgTicketChangePct: pctChange(avgTicket, prevAvgTicket),
  };
}

type RevenueGranularity = "hour" | "day" | "week";

function revenueGranularity(range: AnalyticsDateRange): RevenueGranularity {
  const days = rangeDurationDays(range);
  if (days <= 1) return "hour";
  if (days <= 30) return "day";
  return "week";
}

function weekStartKey(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function formatSeriesLabel(
  key: string,
  granularity: RevenueGranularity
): string {
  if (granularity === "hour") {
    const hour = Number(key);
    return `${String(hour).padStart(2, "0")}:00`;
  }
  if (granularity === "day") {
    const date = new Date(`${key}T12:00:00`);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function computeRevenueSeries(
  orders: AdminAnalyticsOrder[],
  range: AnalyticsDateRange
): RevenueSeriesPoint[] {
  const granularity = revenueGranularity(range);
  const buckets = new Map<string, number>();

  if (granularity === "hour") {
    for (let h = 0; h < 24; h++) {
      buckets.set(String(h), 0);
    }
  } else if (granularity === "day") {
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      buckets.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    while (cursor <= end) {
      buckets.set(weekStartKey(cursor), 0);
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  for (const order of paidOrders(orders)) {
    const created = new Date(order.created_at);
    let key: string;
    if (granularity === "hour") {
      key = String(created.getHours());
    } else if (granularity === "day") {
      key = order.created_at.slice(0, 10);
    } else {
      key = weekStartKey(created);
    }
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + Number(order.total));
  }

  return Array.from(buckets.entries()).map(([key, revenue]) => ({
    label: formatSeriesLabel(key, granularity),
    revenue,
  }));
}

export function computeTopItemsWithRevenue(
  orders: AdminAnalyticsOrder[],
  limit = 5
): TopItemRow[] {
  const byProduct = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();

  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      const key = item.product_id ?? item.product_name;
      const existing = byProduct.get(key) ?? {
        name: item.product_name,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.total);
      byProduct.set(key, existing);
    }
  }

  return Array.from(byProduct.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
    }));
}

export function computeHourlyOrders(
  orders: AdminAnalyticsOrder[]
): HourlyOrdersPoint[] {
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

export function computePaymentMethods(
  orders: AdminAnalyticsOrder[]
): PaymentMethodSlice[] {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const order of paidOrders(orders)) {
    const key = order.payment_method;
    if (!PAYMENT_METHOD_KEYS.includes(key as (typeof PAYMENT_METHOD_KEYS)[number])) {
      continue;
    }
    const amount = Number(order.total);
    totals.set(key, (totals.get(key) ?? 0) + amount);
    grandTotal += amount;
  }

  if (grandTotal === 0) {
    return [];
  }

  return PAYMENT_METHOD_KEYS.filter((key) => (totals.get(key) ?? 0) > 0).map(
    (key) => {
      const total = totals.get(key) ?? 0;
      return {
        key,
        name: PAYMENT_LABELS[key],
        total,
        percent: (total / grandTotal) * 100,
      };
    }
  );
}

export function computeOrderSources(
  orders: AdminAnalyticsOrder[]
): OrderSourceSlice[] {
  const counts = new Map<OrderSourceSlice["key"], number>();
  for (const key of ["qr", "staff", "kiosk", "pos"] as const) {
    counts.set(key, 0);
  }

  for (const order of orders) {
    const key = order.order_source ?? "qr";
    if (key in ORDER_SOURCE_LABELS) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const total = orders.length;
  if (total === 0) return [];

  return (["qr", "staff", "kiosk", "pos"] as const)
    .map((key) => ({
      key,
      name: ORDER_SOURCE_LABELS[key],
      count: counts.get(key) ?? 0,
      percent: ((counts.get(key) ?? 0) / total) * 100,
    }))
    .filter((slice) => slice.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function buildAdminAnalyticsSnapshot(
  orders: AdminAnalyticsOrder[],
  previousOrders: AdminAnalyticsOrder[],
  range: AnalyticsDateRange
): AdminAnalyticsSnapshot {
  return {
    kpis: computeKpis(orders, previousOrders),
    revenueSeries: computeRevenueSeries(orders, range),
    topItems: computeTopItemsWithRevenue(orders),
    hourlyOrders: computeHourlyOrders(orders),
    paymentMethods: computePaymentMethods(orders),
    orderSources: computeOrderSources(orders),
  };
}

export async function loadAdminAnalyticsOrders(
  locationId: string,
  from: Date,
  to: Date
): Promise<AdminAnalyticsOrder[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      `
      id,
      total,
      status,
      payment_status,
      payment_method,
      order_source,
      created_at,
      order_items ( product_id, product_name, quantity, total )
    `
    )
    .eq("location_id", locationId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .not("status", "in", '("cancelled","rejected")');

  return (data ?? []) as unknown as AdminAnalyticsOrder[];
}

export async function loadAdminAnalyticsSnapshot(
  range: AnalyticsDateRange,
  previousRange: { start: Date; end: Date }
): Promise<AdminAnalyticsSnapshot | null> {
  const staff = await requireAdmin();
  const locationId = await getStaffLocationId(staff);
  if (!locationId) return null;

  const [orders, previousOrders] = await Promise.all([
    loadAdminAnalyticsOrders(locationId, range.start, range.end),
    loadAdminAnalyticsOrders(
      locationId,
      previousRange.start,
      previousRange.end
    ),
  ]);

  return buildAdminAnalyticsSnapshot(orders, previousOrders, range);
}
