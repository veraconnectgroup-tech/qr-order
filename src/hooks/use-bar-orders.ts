"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ORDER_WITH_DETAILS_SELECT,
  orderWithDetailsRows,
} from "@/lib/supabase/query-rows";
import {
  buildBarStatsSnapshot,
  groupBarDrinkRounds,
  predictBarRefillHints,
  prioritizeBarQueue,
  type BarQueueEntry,
  type BarRefillHint,
  type BarRoundGroup,
  type BarStatsSnapshot,
} from "@/lib/bar/bar-intelligence";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { KDS_DELIVERED_HIDE_MS } from "@/lib/kds/settings";
import { orderHasDrinksItems } from "@/lib/kitchen/menu-section";
import {
  attachStationStates,
  fetchOrderStationStates,
  type OrderStationState,
} from "@/lib/orders/fetch-order-station-states";
import { isBarWorkComplete } from "@/lib/orders/station-display";
import type { StationKind, StationStatus } from "@/lib/orders/station-states";
import type { OrderWithDetails } from "@/types";

const ACTIVE_STATUSES = [
  "pending_approval",
  "pending",
  "accepted",
  "preparing",
  "ready",
] as const;

export type BarOrdersSnapshot = {
  queue: BarQueueEntry[];
  rounds: BarRoundGroup[];
  refillHints: BarRefillHint[];
  stats: BarStatsSnapshot;
};

export type BarOrder = OrderWithDetails & {
  station_states: OrderStationState[];
};

export function useBarOrders(locationId: string) {
  const [allOrders, setAllOrders] = useState<BarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const { play } = useSoundAlert();

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
      console.error("Bar orders fetch failed:", fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setError(null);
    const rows = orderWithDetailsRows(data);
    const stationRows = await fetchOrderStationStates(
      supabase,
      rows.map((row) => row.id)
    );
    const merged = attachStationStates(rows, stationRows);
    setAllOrders(merged);

    const drinkOrders = merged.filter(orderHasDrinksItems);
    if (initializedRef.current) {
      for (const order of drinkOrders) {
        if (
          !knownOrderIdsRef.current.has(order.id) &&
          (order.status === "pending" ||
            order.status === "pending_approval" ||
            order.status === "accepted")
        ) {
          play("bar-order");
          break;
        }
      }
    }

    knownOrderIdsRef.current = new Set(drinkOrders.map((order) => order.id));
    initializedRef.current = true;
    setLoading(false);
  }, [locationId, play]);

  const optimisticUpdateStationStatus = useCallback(
    (
      orderId: string,
      station: StationKind,
      status: StationStatus,
      globalStatus?: OrderWithDetails["status"]
    ) => {
      const now = new Date().toISOString();
      setAllOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const station_states = order.station_states.map((row) =>
            row.station === station ? { ...row, status } : row
          );
          const patch: Partial<BarOrder> = { station_states };
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
      setAllOrders((prev) =>
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

  const snapshot = useMemo((): BarOrdersSnapshot => {
    const drinkOrders = allOrders
      .filter(orderHasDrinksItems)
      .filter(
        (order) =>
          !isBarWorkComplete(
            order.status,
            order.station_states.find((row) => row.station === "bar")
          )
      );
    const queue = prioritizeBarQueue(drinkOrders, allOrders);
    return {
      queue,
      rounds: groupBarDrinkRounds(queue),
      refillHints: predictBarRefillHints(allOrders),
      stats: buildBarStatsSnapshot(allOrders),
    };
  }, [allOrders]);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchOrders();
  }, [locationId, fetchOrders]);

  usePostgresRealtime({
    channelName: `bar-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `bar-station-states:${locationId}`,
    table: "order_station_states",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return {
    orders: snapshot.queue.map((entry) => entry.order),
    queue: snapshot.queue,
    rounds: snapshot.rounds,
    refillHints: snapshot.refillHints,
    stats: snapshot.stats,
    loading,
    error,
    refetch: fetchOrders,
    optimisticUpdateStatus,
    optimisticUpdateStationStatus,
  };
}
