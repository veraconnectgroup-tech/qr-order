"use client";

import { useEffect } from "react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { fetchWaiterTableRows } from "@/lib/dashboard/fetch-waiter-table-rows";
import { setWaiterAppBadge } from "@/lib/waiter/app-badge";

export function WaiterDataPrefetch() {
  const { locationId } = useDashboard();

  useEffect(() => {
    void fetchWaiterTableRows(locationId);
  }, [locationId]);

  return null;
}

export function WaiterUxEffects() {
  const { totalPendingAlerts } = useDashboardAlerts();

  useEffect(() => {
    void setWaiterAppBadge(totalPendingAlerts);
  }, [totalPendingAlerts]);

  useEffect(() => {
    return () => {
      void setWaiterAppBadge(0);
    };
  }, []);

  return null;
}
