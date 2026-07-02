import {
  isKitchenMenuSection,
  isDrinksMenuSection,
} from "@/lib/kitchen/menu-section";
import type { OrderFact, OrderStationFact } from "@/lib/denis/loop/types";
import type { StationTriggerOrder } from "@/lib/denis/stations/question-triggers";

export function stationsForOrderFact(order: OrderFact): {
  hasKitchenItems: boolean;
  hasDrinkItems: boolean;
} {
  return {
    hasKitchenItems: order.items.some((item) =>
      isKitchenMenuSection(item.menuSection)
    ),
    hasDrinkItems: order.items.some((item) =>
      isDrinksMenuSection(item.menuSection)
    ),
  };
}

export function orderFactToTriggerOrder(order: OrderFact): StationTriggerOrder {
  const { hasKitchenItems, hasDrinkItems } = stationsForOrderFact(order);
  const kitchen = order.stationStates?.find((row) => row.station === "kitchen");
  const bar = order.stationStates?.find((row) => row.station === "bar");

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    preparingAt: null,
    readyAt: null,
    hasKitchenItems,
    hasDrinkItems,
    kitchenStation: kitchen
      ? {
          status: kitchen.status,
          readyAt: kitchen.readyAt,
          pickedUpAt: kitchen.pickedUpAt,
        }
      : null,
    barStation: bar
      ? {
          status: bar.status,
          readyAt: bar.readyAt,
          pickedUpAt: bar.pickedUpAt,
        }
      : null,
  };
}

export function mapStationStateRows(
  rows: Array<{
    order_id: string;
    station: "kitchen" | "bar";
    status: OrderStationFact["status"];
    ready_at: string | null;
    picked_up_at: string | null;
  }>
): Map<string, OrderStationFact[]> {
  const map = new Map<string, OrderStationFact[]>();
  for (const row of rows) {
    const list = map.get(row.order_id) ?? [];
    list.push({
      station: row.station,
      status: row.status,
      readyAt: row.ready_at,
      pickedUpAt: row.picked_up_at,
    });
    map.set(row.order_id, list);
  }
  return map;
}
