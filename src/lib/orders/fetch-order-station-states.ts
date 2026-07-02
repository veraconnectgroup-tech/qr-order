import type { SupabaseClient } from "@supabase/supabase-js";
import type { StationKind, StationStatus } from "@/lib/orders/station-states";
import type { Database } from "@/types/database";

export type OrderStationState = {
  order_id: string;
  station: StationKind;
  status: StationStatus;
  ready_at: string | null;
  picked_up_at: string | null;
  served_at: string | null;
};

type Client = SupabaseClient<Database>;

export async function fetchOrderStationStates(
  supabase: Client,
  orderIds: string[]
): Promise<OrderStationState[]> {
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("order_station_states")
    .select(
      "order_id, station, status, ready_at, picked_up_at, served_at"
    )
    .in("order_id", orderIds);

  if (error) {
    console.error("order_station_states fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as OrderStationState[];
}

export function groupStationStatesByOrderId(
  rows: OrderStationState[]
): Map<string, OrderStationState[]> {
  const map = new Map<string, OrderStationState[]>();
  for (const row of rows) {
    const list = map.get(row.order_id) ?? [];
    list.push(row);
    map.set(row.order_id, list);
  }
  return map;
}

export function attachStationStates<T extends { id: string }>(
  orders: T[],
  rows: OrderStationState[]
): Array<T & { station_states: OrderStationState[] }> {
  const byOrder = groupStationStatesByOrderId(rows);
  return orders.map((order) => ({
    ...order,
    station_states: byOrder.get(order.id) ?? [],
  }));
}
