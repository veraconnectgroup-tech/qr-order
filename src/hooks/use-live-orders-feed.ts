"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import type { OverviewLiveFeedOrder } from "@/lib/dashboard/overview-types";
import { startOfTodayIso } from "@/lib/dashboard/overview-stats";

const FEED_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
] as const;

export function useLiveOrdersFeed(initial?: OverviewLiveFeedOrder[]) {
  const { locationId } = useDashboard();
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OverviewLiveFeedOrder[]>(initial ?? []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();

    const [{ data: feedRows, error: feedError }, { data: tablesRows, error: tablesError }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, total, status, created_at, table_id")
          .eq("location_id", locationId)
          .gte("created_at", todayStart)
          .in("status", [...FEED_STATUSES])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("tables")
          .select("id, name")
          .eq("location_id", locationId)
          .is("deleted_at", null),
      ]);

    if (feedError || tablesError) {
      setError(feedError?.message ?? tablesError?.message ?? "Failed to load feed");
      return;
    }

    setError(null);
    const tableNames = new Map(
      ((tablesRows ?? []) as Array<{ id: string; name: string }>).map((t) => [
        t.id,
        t.name,
      ])
    );

    setOrders(
      ((feedRows ?? []) as Array<{
        id: string;
        order_number: number;
        total: number;
        status: string;
        created_at: string;
        table_id: string | null;
      }>).map((row) => ({
        id: row.id,
        order_number: row.order_number,
        total: Number(row.total),
        status: row.status,
        created_at: row.created_at,
        table_name: row.table_id
          ? (tableNames.get(row.table_id) ?? "—")
          : "—",
      }))
    );
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

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const realtimeMode = usePostgresRealtime({
    channelName: `live-orders-feed:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  return { loading, error, orders, realtimeMode, refresh };
}

export type { OverviewLiveFeedOrder as LiveFeedOrder };
