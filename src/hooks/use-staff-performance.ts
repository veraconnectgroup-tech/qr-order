"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import {
  computeStaffPerformance,
  type StaffPerformanceRow,
} from "@/lib/dashboard/staff-performance";
import { startOfTodayIso } from "@/lib/dashboard/overview-stats";

export function useStaffPerformance(initial?: StaffPerformanceRow[]) {
  const { locationId, orgId } = useDashboard();
  const [loading, setLoading] = useState(!initial?.length);
  const [rows, setRows] = useState<StaffPerformanceRow[]>(initial ?? []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();

    const [{ data: orderRows }, { data: callRows }, { data: staffRows }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("created_by_staff_id, total, status")
          .eq("location_id", locationId)
          .gte("created_at", todayStart)
          .neq("status", "rejected")
          .neq("status", "cancelled"),
        supabase
          .from("waiter_calls")
          .select("acknowledged_at, created_at")
          .eq("location_id", locationId)
          .gte("created_at", todayStart),
        supabase
          .from("staff")
          .select("id, name")
          .eq("org_id", orgId)
          .is("deleted_at", null),
      ]);

    const staffNames = new Map<string, string>();
    for (const row of (staffRows ?? []) as Array<{ id: string; name: string }>) {
      staffNames.set(row.id, row.name);
    }

    setRows(
      computeStaffPerformance({
        orders: (orderRows ?? []) as Array<{
          created_by_staff_id: string | null;
          total: number;
          status: string;
        }>,
        staffNames,
        waiterCalls: (callRows ?? []) as Array<{
          acknowledged_at: string | null;
          created_at: string;
        }>,
      })
    );
  }, [locationId, orgId]);

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
    channelName: `staff-performance:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  return { loading, rows, refresh };
}
