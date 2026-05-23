"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import type { OverviewStatsSnapshot } from "@/lib/dashboard/overview-types";
import {
  computeOverviewDayStats,
  startOfTodayIso,
  startOfYesterdayIso,
} from "@/lib/dashboard/overview-stats";

export function useDashboardStats(initial?: OverviewStatsSnapshot) {
  const { locationId } = useDashboard();
  const [loading, setLoading] = useState(!initial);
  const [todayRevenue, setTodayRevenue] = useState(initial?.todayRevenue ?? 0);
  const [todayOrderCount, setTodayOrderCount] = useState(
    initial?.todayOrderCount ?? 0
  );
  const [todayAvgTicket, setTodayAvgTicket] = useState(
    initial?.todayAvgTicket ?? 0
  );
  const [yesterdayRevenue, setYesterdayRevenue] = useState(
    initial?.yesterdayRevenue ?? 0
  );
  const [yesterdayOrderCount, setYesterdayOrderCount] = useState(
    initial?.yesterdayOrderCount ?? 0
  );
  const [yesterdayAvgTicket, setYesterdayAvgTicket] = useState(
    initial?.yesterdayAvgTicket ?? 0
  );
  const [activeSessions, setActiveSessions] = useState(
    initial?.activeSessions ?? 0
  );
  const [totalTables, setTotalTables] = useState(initial?.totalTables ?? 0);
  const [pendingWaiterCalls, setPendingWaiterCalls] = useState(
    initial?.pendingWaiterCalls ?? 0
  );

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();
    const yesterdayStart = startOfYesterdayIso();

    const [
      { data: todayRows },
      { data: yesterdayRows },
      { count: sessionCount },
      { count: tableCount },
      { count: callCount },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("total, status")
        .eq("location_id", locationId)
        .gte("created_at", todayStart)
        .neq("status", "rejected")
        .neq("status", "cancelled"),
      supabase
        .from("orders")
        .select("total, status")
        .eq("location_id", locationId)
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart)
        .neq("status", "rejected")
        .neq("status", "cancelled"),
      supabase
        .from("table_sessions")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "active"),
      supabase
        .from("tables")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .is("deleted_at", null),
      supabase
        .from("waiter_calls")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "pending"),
    ]);

    const today = computeOverviewDayStats(
      (todayRows ?? []) as Array<{ total: number; status: string }>
    );
    const yesterday = computeOverviewDayStats(
      (yesterdayRows ?? []) as Array<{ total: number; status: string }>
    );

    setTodayRevenue(today.revenue);
    setTodayOrderCount(today.count);
    setTodayAvgTicket(today.avg);
    setYesterdayRevenue(yesterday.revenue);
    setYesterdayOrderCount(yesterday.count);
    setYesterdayAvgTicket(yesterday.avg);
    setActiveSessions(sessionCount ?? 0);
    setTotalTables(tableCount ?? 0);
    setPendingWaiterCalls(callCount ?? 0);
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!initial) setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, initial]);

  usePostgresRealtime({
    channelName: `dashboard-stats-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `dashboard-stats-calls:${locationId}`,
    table: "waiter_calls",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  useEffect(() => {
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return {
    loading,
    todayRevenue,
    todayOrderCount,
    todayAvgTicket,
    yesterdayRevenue,
    yesterdayOrderCount,
    yesterdayAvgTicket,
    activeSessions,
    totalTables,
    pendingWaiterCalls,
    refresh,
  };
}
