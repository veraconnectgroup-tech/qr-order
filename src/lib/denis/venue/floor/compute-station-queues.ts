import {
  isBarMenuSection,
  isDessertMenuSection,
  isFoodMenuSection,
} from "@/lib/kitchen/menu-section";
import type { KitchenBacklogOrder } from "@/lib/denis/venue/floor/compute-kds-backlog";
import type { StationQueue } from "@/lib/denis/venue/floor/types";

export type PrepStation = StationQueue["station"];

const ACTIVE_STATUSES = ["pending", "accepted", "preparing"] as const;

const STATIONS: PrepStation[] = ["kitchen", "bar", "dessert"];

function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

function orderHasStationItems(
  order: KitchenBacklogOrder,
  station: PrepStation
): boolean {
  const items = order.order_items ?? [];
  return items.some((item) => {
    switch (station) {
      case "kitchen":
        return isFoodMenuSection(item.menu_section);
      case "bar":
        return isBarMenuSection(item.menu_section);
      case "dessert":
        return isDessertMenuSection(item.menu_section);
    }
  });
}

function elapsedMinutesSince(
  order: KitchenBacklogOrder,
  nowMs: number
): number {
  const since =
    order.preparing_at ?? order.accepted_at ?? order.created_at;
  return Math.max(0, Math.round((nowMs - new Date(since).getTime()) / 60_000));
}

/** Per-station queue snapshot from active orders (kitchen / bar / dessert). */
export function computeStationQueues(
  orders: KitchenBacklogOrder[],
  nowMs = Date.now()
): StationQueue[] {
  return STATIONS.map((station) => {
    const activeOrders = orders.filter(
      (order) =>
        isActiveStatus(order.status) && orderHasStationItems(order, station)
    );

    if (!activeOrders.length) {
      return {
        station,
        activeOrderCount: 0,
        avgWaitMinutes: null,
        oldestOrderMinutes: null,
      };
    }

    const waits = activeOrders.map((order) =>
      elapsedMinutesSince(order, nowMs)
    );
    const total = waits.reduce((sum, minutes) => sum + minutes, 0);

    return {
      station,
      activeOrderCount: activeOrders.length,
      avgWaitMinutes: Math.round(total / waits.length),
      oldestOrderMinutes: Math.max(...waits),
    };
  });
}
