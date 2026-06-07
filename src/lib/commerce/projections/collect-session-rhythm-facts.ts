import {
  localSlotFromDate,
  rhythmSlotKey,
  servicePeriodFromHour,
} from "@/lib/denis/config/resolve-rhythm-priors";
import type { VenueServicePeriod } from "@/lib/denis/config/rhythm-prior-types";

export type SessionRhythmFacts = {
  orgId: string;
  locationId: string;
  sessionId: string;
  billStatus: "settled" | "void";
  localDow: number;
  localHour: number;
  slotKey: string;
  durationMin: number;
  dessertDelayMin: number | null;
  revenue: number;
  topProducts: Array<{
    productId: string | null;
    name: string;
    count: number;
  }>;
  servicePeriod: VenueServicePeriod;
  closedAt: string;
};

type OrderRow = {
  id: string;
  status: string;
  total: number;
  payment_status: string | null;
  created_at: string;
  delivered_at: string | null;
  order_items: Array<{
    product_id: string | null;
    product_name: string;
    menu_section: string | null;
    quantity: number;
  }> | null;
};

function countsTowardRevenue(status: string): boolean {
  return status !== "cancelled" && status !== "void";
}

function isPaid(paymentStatus: string | null): boolean {
  return paymentStatus === "paid";
}

function computeDessertDelayMin(orders: OrderRow[]): number | null {
  let mainDeliveredAt: number | null = null;
  let dessertOrderedAt: number | null = null;

  for (const order of orders) {
    const createdAt = new Date(order.created_at).getTime();
    if (!Number.isFinite(createdAt)) continue;

    const items = order.order_items ?? [];
    const hasDessert = items.some((item) => item.menu_section === "desserts");
    const hasMain = items.some(
      (item) =>
        item.menu_section !== "desserts" && item.menu_section !== "drinks"
    );

    if (hasDessert && dessertOrderedAt == null) {
      dessertOrderedAt = createdAt;
    }

    if (hasMain && order.delivered_at) {
      const deliveredAt = new Date(order.delivered_at).getTime();
      if (Number.isFinite(deliveredAt)) {
        mainDeliveredAt =
          mainDeliveredAt == null
            ? deliveredAt
            : Math.min(mainDeliveredAt, deliveredAt);
      }
    }
  }

  if (mainDeliveredAt == null || dessertOrderedAt == null) {
    return null;
  }

  const delayMin = (dessertOrderedAt - mainDeliveredAt) / 60_000;
  if (!Number.isFinite(delayMin) || delayMin < 0) {
    return null;
  }

  return Math.round(delayMin * 10) / 10;
}

function aggregateTopProducts(orders: OrderRow[]) {
  const counts = new Map<
    string,
    { productId: string | null; name: string; count: number }
  >();

  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      const name = item.product_name?.trim();
      if (!name) continue;
      const key = item.product_id ?? name;
      const existing = counts.get(key);
      if (existing) {
        existing.count += item.quantity;
      } else {
        counts.set(key, {
          productId: item.product_id,
          name,
          count: item.quantity,
        });
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** Collect rhythm facts for a closed table session (VRP-P0). */
export function buildSessionRhythmFacts(input: {
  orgId: string;
  locationId: string;
  sessionId: string;
  billStatus: "settled" | "void";
  openedAt: string;
  closedAt: string;
  timezone: string;
  orders: OrderRow[];
}): SessionRhythmFacts | null {
  if (input.billStatus === "void") {
    return null;
  }

  const openedAtMs = new Date(input.openedAt).getTime();
  const closedAtMs = new Date(input.closedAt).getTime();
  if (!Number.isFinite(openedAtMs) || !Number.isFinite(closedAtMs)) {
    return null;
  }

  const durationMin = Math.max(0, (closedAtMs - openedAtMs) / 60_000);
  if (durationMin < 2) {
    return null;
  }

  const { dow, hour } = localSlotFromDate(new Date(input.openedAt), input.timezone);
  const revenueOrders = input.orders.filter(
    (order) => countsTowardRevenue(order.status) && isPaid(order.payment_status)
  );
  const revenue = revenueOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0
  );

  return {
    orgId: input.orgId,
    locationId: input.locationId,
    sessionId: input.sessionId,
    billStatus: input.billStatus,
    localDow: dow,
    localHour: hour,
    slotKey: rhythmSlotKey(dow, hour),
    durationMin: Math.round(durationMin * 10) / 10,
    dessertDelayMin: computeDessertDelayMin(input.orders),
    revenue: Math.round(revenue * 100) / 100,
    topProducts: aggregateTopProducts(input.orders),
    servicePeriod: servicePeriodFromHour(hour),
    closedAt: input.closedAt,
  };
}

export type { OrderRow as SessionRhythmOrderRow };
