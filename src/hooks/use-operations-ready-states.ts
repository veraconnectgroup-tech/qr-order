"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import {
  minutesSince,
  type OperationsReadyStuckRow,
} from "@/lib/dashboard/operations-triage";

type StationStateRow = {
  order_id: string;
  station: "kitchen" | "bar";
  ready_at: string;
};

type OrderRow = {
  id: string;
  order_number: number | null;
  table_id: string | null;
  ready_at: string | null;
};

type TableRow = {
  id: string;
  name: string;
};

async function enrichReadyRows(
  supabase: ReturnType<typeof createClient>,
  states: StationStateRow[]
): Promise<OperationsReadyStuckRow[]> {
  if (states.length === 0) return [];

  const orderIds = [...new Set(states.map((row) => row.order_id))];
  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, order_number, table_id, ready_at")
    .in("id", orderIds);

  const orders = (ordersData ?? []) as OrderRow[];
  const orderMap = new Map(orders.map((row) => [row.id, row]));

  const tableIds = [
    ...new Set(
      orders
        .map((row) => row.table_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const tableMap = new Map<string, string>();
  if (tableIds.length > 0) {
    const { data: tablesData } = await supabase
      .from("tables")
      .select("id, name")
      .in("id", tableIds);

    for (const table of (tablesData ?? []) as TableRow[]) {
      tableMap.set(table.id, table.name);
    }
  }

  const now = Date.now();
  return states.map((row) => {
    const order = orderMap.get(row.order_id);
    const tableId = order?.table_id ?? null;
    return {
      orderId: row.order_id,
      orderNumber: order?.order_number ?? null,
      station: row.station,
      readyAt: row.ready_at,
      waitMinutes: minutesSince(row.ready_at, now),
      tableId,
      tableName: tableId ? tableMap.get(tableId) ?? null : null,
    };
  });
}

async function fetchLegacyReadyRows(
  supabase: ReturnType<typeof createClient>,
  locationId: string
): Promise<OperationsReadyStuckRow[]> {
  const { data: ordersData, error } = await supabase
    .from("orders")
    .select("id, order_number, ready_at, table_id")
    .eq("location_id", locationId)
    .eq("status", "ready")
    .not("ready_at", "is", null);

  if (error || !ordersData?.length) {
    return [];
  }

  const orders = ordersData as OrderRow[];
  const tableIds = [
    ...new Set(
      orders
        .map((row) => row.table_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const tableMap = new Map<string, string>();
  if (tableIds.length > 0) {
    const { data: tablesData } = await supabase
      .from("tables")
      .select("id, name")
      .in("id", tableIds);

    for (const table of (tablesData ?? []) as TableRow[]) {
      tableMap.set(table.id, table.name);
    }
  }

  const now = Date.now();
  return orders
    .filter((row) => row.ready_at)
    .map((row) => ({
      orderId: row.id,
      orderNumber: row.order_number,
      station: "kitchen" as const,
      readyAt: row.ready_at!,
      waitMinutes: minutesSince(row.ready_at!, now),
      tableId: row.table_id,
      tableName: row.table_id ? tableMap.get(row.table_id) ?? null : null,
    }));
}

/** Ready station rows not yet picked up — primary: order_station_states, fallback: global ready orders. */
export function useOperationsReadyStates(locationId: string) {
  const [rows, setRows] = useState<OperationsReadyStuckRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!locationId) {
      setRows([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("order_station_states")
      .select("order_id, station, ready_at")
      .eq("location_id", locationId)
      .eq("status", "ready")
      .is("picked_up_at", null)
      .not("ready_at", "is", null);

    if (error) {
      setRows(await fetchLegacyReadyRows(supabase, locationId));
      setLoading(false);
      return;
    }

    const states = (data ?? []) as StationStateRow[];
    if (states.length === 0) {
      setRows(await fetchLegacyReadyRows(supabase, locationId));
      setLoading(false);
      return;
    }

    setRows(await enrichReadyRows(supabase, states));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  usePostgresRealtime({
    channelName: `operations-ready:${locationId}`,
    table: "order_station_states",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchRows,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `operations-ready-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchRows,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return { rows, loading, refetch: fetchRows };
}
