"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useSoundAlert } from "@/hooks/use-sound-alert";

type DashboardAlertsContextValue = {
  pendingOrders: number;
  pendingWaiterCalls: number;
};

const DashboardAlertsContext =
  createContext<DashboardAlertsContextValue | null>(null);

export function DashboardAlertsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locationId } = useDashboard();
  const { play } = useSoundAlert();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingWaiterCalls, setPendingWaiterCalls] = useState(0);
  const [ready, setReady] = useState(false);
  const prevPendingOrders = useRef(0);
  const prevPendingCalls = useRef(0);

  const refreshCounts = useCallback(async () => {
    const supabase = createClient();
    const [{ count: orderCount }, { count: callCount }] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "pending"),
      supabase
        .from("waiter_calls")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "pending"),
    ]);

    setPendingOrders(orderCount ?? 0);
    setPendingWaiterCalls(callCount ?? 0);
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;
    refreshCounts().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshCounts]);

  usePostgresRealtime({
    channelName: `dashboard-alerts-orders:${locationId}`,
    table: "orders",
    filter: `location_id=eq.${locationId}`,
    onChange: refreshCounts,
  });

  usePostgresRealtime({
    channelName: `dashboard-alerts-calls:${locationId}`,
    table: "waiter_calls",
    filter: `location_id=eq.${locationId}`,
    onChange: refreshCounts,
  });

  useEffect(() => {
    if (!ready) return;

    if (pendingOrders > prevPendingOrders.current) {
      const delta = pendingOrders - prevPendingOrders.current;
      play("new-order");
      toast.info(
        delta === 1
          ? "New order received"
          : `${delta} new orders · ${pendingOrders} waiting`
      );
    }
    prevPendingOrders.current = pendingOrders;
  }, [pendingOrders, play, ready]);

  useEffect(() => {
    if (!ready) return;

    if (pendingWaiterCalls > prevPendingCalls.current) {
      const delta = pendingWaiterCalls - prevPendingCalls.current;
      play("waiter-call");
      toast.info(
        delta === 1
          ? "Waiter call from a table"
          : `${delta} new waiter calls · ${pendingWaiterCalls} open`
      );
    }
    prevPendingCalls.current = pendingWaiterCalls;
  }, [pendingWaiterCalls, play, ready]);

  return (
    <DashboardAlertsContext.Provider
      value={{ pendingOrders, pendingWaiterCalls }}
    >
      {children}
    </DashboardAlertsContext.Provider>
  );
}

export function useDashboardAlerts() {
  const ctx = useContext(DashboardAlertsContext);
  if (!ctx) {
    throw new Error(
      "useDashboardAlerts must be used within DashboardAlertsProvider"
    );
  }
  return ctx;
}
