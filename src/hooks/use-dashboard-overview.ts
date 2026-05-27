"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import type {
  OverviewSparklinePoint,
  OverviewTableStatus,
} from "@/lib/dashboard/overview-types";
import {
  computeSparklinePoints,
  startOfTodayIso,
  sevenDayRange,
} from "@/lib/dashboard/overview-stats";

type OverviewInitial = {
  sparkline?: OverviewSparklinePoint[];
  tableStatuses?: OverviewTableStatus[];
};

export function useDashboardOverview(initial?: OverviewInitial) {
  const { locationId } = useDashboard();
  const [loading, setLoading] = useState(!initial);
  const [sparkline, setSparkline] = useState<OverviewSparklinePoint[]>(
    initial?.sparkline ?? []
  );
  const [tableStatuses, setTableStatuses] = useState<OverviewTableStatus[]>(
    initial?.tableStatuses ?? []
  );

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();
    const { start: weekStart } = sevenDayRange();

    const [
      { data: weekRows },
      { data: sessionRows },
      { data: sessionOrders },
      { data: tablesRows },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("total, status, created_at")
        .eq("location_id", locationId)
        .gte("created_at", weekStart.toISOString())
        .neq("status", "rejected")
        .neq("status", "cancelled"),
      supabase
        .from("table_sessions")
        .select("id, table_id, opened_at")
        .eq("location_id", locationId)
        .eq("status", "active"),
      supabase
        .from("orders")
        .select(
          "session_id, table_id, total, status, payment_requested_at, payment_status, payment_method"
        )
        .eq("location_id", locationId)
        .gte("created_at", todayStart)
        .neq("status", "rejected"),
      supabase
        .from("tables")
        .select("id, name, zone_id, zone:zones(id, name)")
        .eq("location_id", locationId)
        .is("deleted_at", null),
    ]);

    setSparkline(
      computeSparklinePoints(
        (weekRows ?? []) as Array<{
          total: number;
          status: string;
          created_at: string;
        }>
      )
    );

    const ordersBySession = new Map<
      string,
      { total: number; hasPaymentRequest: boolean }
    >();

    for (const order of sessionOrders ?? []) {
      const row = order as {
        session_id: string | null;
        total: number;
        payment_requested_at: string | null;
        payment_status: string;
        payment_method: string;
      };
      if (!row.session_id) continue;

      const bucket = ordersBySession.get(row.session_id) ?? {
        total: 0,
        hasPaymentRequest: false,
      };
      bucket.total += Number(row.total);
      if (
        row.payment_status !== "paid" &&
        row.payment_requested_at &&
        row.payment_method !== "unset"
      ) {
        bucket.hasPaymentRequest = true;
      }
      ordersBySession.set(row.session_id, bucket);
    }

    const sessionByTable = new Map<
      string,
      { hasPaymentRequest: boolean; sessionTotal: number }
    >();
    for (const session of (sessionRows ?? []) as Array<{
      id: string;
      table_id: string;
    }>) {
      const stats = ordersBySession.get(session.id) ?? {
        total: 0,
        hasPaymentRequest: false,
      };
      sessionByTable.set(session.table_id, {
        hasPaymentRequest: stats.hasPaymentRequest,
        sessionTotal: stats.total,
      });
    }

    const allTables = (tablesRows ?? []) as unknown as Array<{
      id: string;
      name: string;
      zone_id: string | null;
      zone: { id: string; name: string } | null;
    }>;
    setTableStatuses(
      allTables.map((table) => {
        const session = sessionByTable.get(table.id);
        const base = {
          id: table.id,
          name: table.name,
          zoneId: table.zone_id,
          zoneName: table.zone?.name ?? null,
        };
        if (!session) {
          return { ...base, status: "available" as const };
        }
        return {
          ...base,
          status: session.hasPaymentRequest
            ? ("payment" as const)
            : ("occupied" as const),
          sessionTotal: session.sessionTotal,
        };
      })
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

  usePostgresRealtime({
    channelName: `dashboard-overview:${locationId}`,
    table: "orders",
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
    sparkline,
    tableStatuses,
    refresh,
  };
}

export type { OverviewTableStatus };
