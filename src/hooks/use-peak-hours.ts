"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import {
  computePeakHoursHeatmap,
  type PeakHourBucket,
} from "@/lib/dashboard/peak-hours";
import { startOfTodayIso } from "@/lib/dashboard/overview-stats";

export function usePeakHours(initial?: PeakHourBucket[]) {
  const { locationId } = useDashboard();
  const [loading, setLoading] = useState(!initial?.length);
  const [buckets, setBuckets] = useState<PeakHourBucket[]>(initial ?? []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const todayStart = startOfTodayIso();
    const { data } = await supabase
      .from("orders")
      .select("total, status, created_at")
      .eq("location_id", locationId)
      .gte("created_at", todayStart)
      .neq("status", "rejected")
      .neq("status", "cancelled");

    setBuckets(
      computePeakHoursHeatmap(
        (data ?? []) as Array<{
          total: number;
          status: string;
          created_at: string;
        }>
      )
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
    channelName: `peak-hours:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refresh,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  return { loading, buckets, refresh };
}
