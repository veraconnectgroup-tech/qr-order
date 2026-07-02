"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ORDER_WITH_DETAILS_SELECT,
  orderWithDetailsRows,
} from "@/lib/supabase/query-rows";

import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useProvisionalPosOrders } from "@/hooks/use-provisional-pos-orders";
import {
  buildKitchenPrepBatches,
  sortKitchenOrdersByUrgency,
} from "@/lib/kitchen/kds-intelligence";
import {
  mergeKdsOrdersWithProvisionals,
  isProvisionalKdsOrder,
  type ProvisionalKdsOrder,
} from "@/lib/pos/provisional-display";
import type { OrderWithDetails } from "@/types";
import { orderHasKitchenItems } from "@/lib/kitchen/menu-section";
import {
  attachStationStates,
  fetchOrderStationStates,
  type OrderStationState,
} from "@/lib/orders/fetch-order-station-states";

export type KitchenOrder = OrderWithDetails & {
  station_states: OrderStationState[];
};

export function useKitchenOrders(locationId: string) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locationRef = useRef(locationId);

  const fetchOrders = useCallback(async () => {
    if (!locationId) return;

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(ORDER_WITH_DETAILS_SELECT)
      .eq("location_id", locationId)
      .in("status", ["accepted", "preparing"])
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Kitchen orders fetch failed:", fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setError(null);
    const rows = orderWithDetailsRows(data).filter(orderHasKitchenItems);
    const stationRows = await fetchOrderStationStates(
      supabase,
      rows.map((row) => row.id)
    );
    setOrders(attachStationStates(rows, stationRows));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    locationRef.current = locationId;
  }, [locationId]);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchOrders();
  }, [locationId, fetchOrders]);

  const realtimeMode = usePostgresRealtime({
    channelName: `kitchen-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
  });

  usePostgresRealtime({
    channelName: `kitchen-station-states:${locationId}`,
    table: "order_station_states",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
  });

  const provisional = useProvisionalPosOrders(locationId);

  const displayOrders = useMemo(
    () =>
      mergeKdsOrdersWithProvisionals(orders, provisional.entries) as Array<
        OrderWithDetails | ProvisionalKdsOrder
      >,
    [orders, provisional.entries]
  );

  const kitchenOrders = useMemo(
    () =>
      displayOrders.filter(
        (order): order is OrderWithDetails => !isProvisionalKdsOrder(order)
      ),
    [displayOrders]
  );

  const sortedOrders = useMemo(() => {
    const provisionals = displayOrders.filter(isProvisionalKdsOrder);
    return [
      ...sortKitchenOrdersByUrgency(kitchenOrders),
      ...provisionals,
    ] as Array<OrderWithDetails | ProvisionalKdsOrder>;
  }, [displayOrders, kitchenOrders]);

  const prepBatches = useMemo(
    () => buildKitchenPrepBatches(kitchenOrders),
    [kitchenOrders]
  );

  return {
    orders: sortedOrders,
    serverOrders: orders,
    kitchenOrders,
    prepBatches,
    loading,
    error,
    refetch: fetchOrders,
    realtimeMode,
    provisionalEnabled: provisional.enabled,
    provisionalSyncFailedCount: provisional.syncFailedCount,
  };
}
