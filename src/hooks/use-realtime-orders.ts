"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";
import { REALTIME_BACKUP_POLL_MS, REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import {
  computeOverviewDayStats,
  startOfTodayIso,
} from "@/lib/dashboard/overview-stats";
import type { OverviewStatsSnapshot } from "@/lib/dashboard/overview-types";

/**
 * Subscribes to order changes for a location via Supabase Realtime
 * (with polling fallback). Used by dashboard order views; returns
 * connection mode — callers refetch orders in `onChange`.
 */
export function useRealtimeOrders(
  locationId: string,
  onChange: () => void,
  options?: { enabled?: boolean; fallbackPollMs?: number; backupPollMs?: number }
): RealtimeMode {
  return usePostgresRealtime({
    channelName: `orders-realtime:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange,
    enabled: options?.enabled ?? Boolean(locationId),
    fallbackPollMs: options?.fallbackPollMs,
    backupPollMs: options?.backupPollMs ?? REALTIME_BACKUP_POLL_MS,
  });
}

export type RealtimeOrderTicker = Pick<
  OverviewStatsSnapshot,
  "todayRevenue" | "todayOrderCount" | "todayAvgTicket"
>;

/** Live today revenue / order count for the dashboard ticker. */
export function useRealtimeOrderTicker(initial?: RealtimeOrderTicker) {
  const { locationId } = useDashboard();
  const [loading, setLoading] = useState(!initial);
  const [todayRevenue, setTodayRevenue] = useState(initial?.todayRevenue ?? 0);
  const [todayOrderCount, setTodayOrderCount] = useState(
    initial?.todayOrderCount ?? 0
  );
  const [todayAvgTicket, setTodayAvgTicket] = useState(
    initial?.todayAvgTicket ?? 0
  );

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();
    const { data } = await supabase
      .from("orders")
      .select("total, status")
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .neq("status", "rejected")
      .neq("status", "cancelled");

    const stats = computeOverviewDayStats(
      (data ?? []) as Array<{ total: number; status: string }>
    );
    setTodayRevenue(stats.revenue);
    setTodayOrderCount(stats.count);
    setTodayAvgTicket(stats.avg);
  }, [locationId]);

  useEffect(() => {
    if (initial) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, initial]);

  usePostgresRealtime({
    channelName: `order-ticker:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  return {
    loading,
    todayRevenue,
    todayOrderCount,
    todayAvgTicket,
    refresh,
  };
}
