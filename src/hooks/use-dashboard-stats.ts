"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  revenueEligibleOrders,
  sumOrderRevenue,
} from "@/lib/orders/revenue";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useDashboardStats() {
  const { locationId } = useDashboard();
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("total, status")
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso());

    const rows =
      (data as Array<{ total: number; status: string }> | null) ?? [];
    const activeToday = rows.filter(
      (o) => o.status !== "rejected" && o.status !== "cancelled"
    );
    setTodayOrderCount(activeToday.length);
    setTodayRevenue(sumOrderRevenue(rows));
  }, [locationId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return {
    todayOrderCount,
    todayRevenue,
    refresh,
    newCount: 0,
    preparingCount: 0,
    readyCount: 0,
    pendingCalls: 0,
  };
}
