"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseDashboardTableStatusRows } from "@/lib/supabase/query-rows";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import {
  buildFloorTableRows,
  type FloorTableRow,
} from "@/lib/dashboard/floor-status";
import { startOfTodayIso } from "@/lib/dashboard/overview-stats";

export function useFloorStatus(initial?: FloorTableRow[]) {
  const { locationId } = useDashboard();
  const [loading, setLoading] = useState(!initial?.length);
  const [tables, setTables] = useState<FloorTableRow[]>(initial ?? []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();

    const [
      { data: tablesRows },
      { data: sessionRows },
      { data: orderRows },
      { data: callRows },
      { data: aiSessionRows },
    ] = await Promise.all([
      supabase
        .from("tables")
        .select("id, name, zone_id, zone:zones(id, name)")
        .eq("location_id", locationId)
        .is("deleted_at", null),
      supabase
        .from("table_sessions")
        .select("id, table_id, opened_at")
        .eq("location_id", locationId)
        .eq("status", "active"),
      supabase
        .from("orders")
        .select(
          "id, table_id, session_id, total, status, payment_requested_at, payment_status, payment_method, created_at"
        )
        .eq("location_id", locationId)
        .gte("created_at", todayStart)
        .neq("status", "cancelled"),
      supabase
        .from("waiter_calls")
        .select("table_id")
        .eq("location_id", locationId)
        .eq("status", "pending"),
      supabase
        .from("ai_sessions")
        .select("id, table_id")
        .eq("location_id", locationId)
        .eq("status", "active"),
    ]);

    const waiterCallTableIds = new Set(
      ((callRows ?? []) as Array<{ table_id: string }>).map(
        (row) => row.table_id
      )
    );

    const aiSessionsByTable = new Map<string, string>();
    for (const row of (aiSessionRows ?? []) as Array<{
      id: string;
      table_id: string;
    }>) {
      aiSessionsByTable.set(row.table_id, row.id);
    }

    const parsedTables = parseDashboardTableStatusRows(tablesRows);
    setTables(
      buildFloorTableRows({
        tables: parsedTables,
        sessions: (sessionRows ?? []) as Array<{
          id: string;
          table_id: string;
          opened_at: string;
        }>,
        orders: (orderRows ?? []) as FloorTableRow["activeOrders"],
        waiterCallTableIds,
        aiSessionsByTable,
      })
    );
  }, [locationId]);

  useEffect(() => {
    if (initial?.length) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, initial?.length]);

  usePostgresRealtime({
    channelName: `floor-status-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `floor-status-sessions:${locationId}`,
    table: "table_sessions",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `floor-status-calls:${locationId}`,
    table: "waiter_calls",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  return { loading, tables, refresh };
}
