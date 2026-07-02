"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ORDER_WITH_DETAILS_SELECT,
  orderWithDetailsRows,
} from "@/lib/supabase/query-rows";

import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useProvisionalPosOrders } from "@/hooks/use-provisional-pos-orders";
import { KDS_DELIVERED_HIDE_MS } from "@/lib/kds/settings";
import { orderHasKitchenItems } from "@/lib/kitchen/menu-section";
import {
  attachStationStates,
  fetchOrderStationStates,
  type OrderStationState,
} from "@/lib/orders/fetch-order-station-states";
import type { StationKind, StationStatus } from "@/lib/orders/station-states";
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

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready"] as const;

export type KdsOrder = OrderWithDetails & {
  station_states: OrderStationState[];
};

export function useKdsOrders(locationId: string) {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [fetchOk, setFetchOk] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!locationId) return;

    const supabase = createClient();
    const deliveredCutoff = new Date(
      Date.now() - KDS_DELIVERED_HIDE_MS
    ).toISOString();

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(ORDER_WITH_DETAILS_SELECT)
      .eq("location_id", locationId)
      .or(
        `status.in.(${ACTIVE_STATUSES.join(",")}),and(status.eq.delivered,delivered_at.gte.${deliveredCutoff})`
      )
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("KDS orders fetch failed:", fetchError.message);
      setError(fetchError.message);
      setFetchOk(false);
      setLoading(false);
      return;
    }

    setError(null);
    setFetchOk(true);
    setLastUpdatedAt(new Date());
    const rows = orderWithDetailsRows(data).filter(orderHasKitchenItems);
    const stationRows = await fetchOrderStationStates(
      supabase,
      rows.map((row) => row.id)
    );
    setOrders(attachStationStates(rows, stationRows));
    setLoading(false);
  }, [locationId]);

  const optimisticUpdateStationStatus = useCallback(
    (
      orderId: string,
      station: StationKind,
      status: StationStatus,
      globalStatus?: OrderWithDetails["status"]
    ) => {
      const now = new Date().toISOString();
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const station_states = order.station_states.map((row) =>
            row.station === station
              ? {
                  ...row,
                  status,
                  ...(status === "in_prep" ? { in_prep_at: now } : {}),
                  ...(status === "ready" ? { ready_at: now } : {}),
                  ...(status === "picked_up" ? { picked_up_at: now } : {}),
                  ...(status === "served" ? { served_at: now } : {}),
                }
              : row
          );
          const patch: Partial<KdsOrder> = { station_states };
          if (globalStatus) {
            patch.status = globalStatus;
            if (globalStatus === "accepted") patch.accepted_at = now;
            if (globalStatus === "preparing") patch.preparing_at = now;
            if (globalStatus === "ready") patch.ready_at = now;
            if (globalStatus === "delivered") patch.delivered_at = now;
          }
          return { ...order, ...patch };
        })
      );
    },
    []
  );

  const optimisticUpdateStatus = useCallback(
    (orderId: string, status: OrderWithDetails["status"]) => {
      const now = new Date().toISOString();
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const patch: Partial<OrderWithDetails> = { status };
          if (status === "accepted") patch.accepted_at = now;
          if (status === "preparing") patch.preparing_at = now;
          if (status === "ready") patch.ready_at = now;
          if (status === "delivered") patch.delivered_at = now;
          return { ...order, ...patch };
        })
      );
    },
    []
  );

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchOrders();
  }, [locationId, fetchOrders]);

  const realtimeMode = usePostgresRealtime({
    channelName: `kds-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `kds-station-states:${locationId}`,
    table: "order_station_states",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  const secondsSinceUpdate = lastUpdatedAt
    ? Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000)
    : null;

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
    lastUpdatedAt,
    fetchOk,
    secondsSinceUpdate,
    optimisticUpdateStatus,
    optimisticUpdateStationStatus,
    provisionalEnabled: provisional.enabled,
    provisionalSyncFailedCount: provisional.syncFailedCount,
  };
}
