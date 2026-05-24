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
import { usePostgresRealtime, reconnectAllRealtimeChannels } from "@/hooks/use-postgres-realtime";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { staffPaymentRequestToast } from "@/lib/payment-request-alert";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";

import type { OrderStatus } from "@/types";

type DashboardAlertsContextValue = {
  pendingOrders: number;
  pendingWaiterCalls: number;
  pendingPaymentRequests: number;
  totalPendingAlerts: number;
  refreshAlerts: () => Promise<void>;
};

const DashboardAlertsContext =
  createContext<DashboardAlertsContextValue | null>(null);

const OPEN_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "pending_approval",
  "accepted",
  "preparing",
  "ready",
];

async function countPaymentRequests(
  supabase: ReturnType<typeof createClient>,
  locationId: string
) {
  const { data: activeSessions } = await supabase
    .from("table_sessions")
    .select("id")
    .eq("location_id", locationId)
    .eq("status", "active");

  const activeSessionIds = (activeSessions ?? []).map(
    (row) => (row as { id: string }).id
  );
  if (activeSessionIds.length === 0) return 0;

  const { data } = await supabase
    .from("orders")
    .select("session_id")
    .eq("location_id", locationId)
    .in("session_id", activeSessionIds)
    .not("payment_requested_at", "is", null)
    .neq("payment_status", "paid")
    .in("status", OPEN_ORDER_STATUSES);

  const sessions = new Set(
    (data ?? [])
      .map((row) => (row as { session_id: string | null }).session_id)
      .filter(Boolean)
  );
  return sessions.size;
}

async function fetchLatestPaymentRequest(
  supabase: ReturnType<typeof createClient>,
  locationId: string
) {
  const { data: activeSessions } = await supabase
    .from("table_sessions")
    .select("id")
    .eq("location_id", locationId)
    .eq("status", "active");

  const activeSessionIds = (activeSessions ?? []).map(
    (row) => (row as { id: string }).id
  );
  if (activeSessionIds.length === 0) return null;

  const { data } = await supabase
    .from("orders")
    .select("total, payment_method, payment_requested_at, tables(name)")
    .eq("location_id", locationId)
    .in("session_id", activeSessionIds)
    .not("payment_requested_at", "is", null)
    .neq("payment_status", "paid")
    .in("status", OPEN_ORDER_STATUSES)
    .order("payment_requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as {
    total: number;
    payment_method: string;
    payment_requested_at: string;
    tables: { name: string } | null;
  } | null;
}

export function DashboardAlertsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locationId, currency, inPersonPaymentLocation } = useDashboard();
  const { play } = useSoundAlert();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingWaiterCalls, setPendingWaiterCalls] = useState(0);
  const [pendingPaymentRequests, setPendingPaymentRequests] = useState(0);
  const [ready, setReady] = useState(false);
  const prevPendingOrders = useRef(0);
  const prevPendingCalls = useRef(0);
  const prevPaymentRequests = useRef(0);
  const lastPaymentToastAt = useRef<string | null>(null);

  const refreshCounts = useCallback(async () => {
    const supabase = createClient();
    const [
      { count: pendingCount },
      { count: approvalCount },
      { count: callCount },
      paymentCount,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "pending"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "pending_approval"),
      supabase
        .from("waiter_calls")
        .select("id", { count: "exact", head: true })
        .eq("location_id", locationId)
        .eq("status", "pending"),
      countPaymentRequests(supabase, locationId),
    ]);

    setPendingOrders((pendingCount ?? 0) + (approvalCount ?? 0));
    setPendingWaiterCalls(callCount ?? 0);
    setPendingPaymentRequests(paymentCount);
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
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refreshCounts,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  usePostgresRealtime({
    channelName: `dashboard-alerts-calls:${locationId}`,
    table: "waiter_calls",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: refreshCounts,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        reconnectAllRealtimeChannels();
        void refreshCounts();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshCounts]);

  useEffect(() => {
    if (!ready) return;

    if (pendingOrders > prevPendingOrders.current) {
      const delta = pendingOrders - prevPendingOrders.current;
      play("new-order");
      toast.info(
        delta === 1
          ? "New order — check Orders board"
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

  useEffect(() => {
    if (!ready) return;
    if (pendingPaymentRequests <= prevPaymentRequests.current) {
      prevPaymentRequests.current = pendingPaymentRequests;
      return;
    }

    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const latest = await fetchLatestPaymentRequest(supabase, locationId);
      if (cancelled || !latest) return;

      if (latest.payment_requested_at === lastPaymentToastAt.current) {
        prevPaymentRequests.current = pendingPaymentRequests;
        return;
      }

      lastPaymentToastAt.current = latest.payment_requested_at;
      play("payment-request");
      toast.info(
        staffPaymentRequestToast({
          tableName: latest.tables?.name ?? "Table",
          paymentMethod: latest.payment_method,
          total: Number(latest.total),
          currency,
          inPersonLocation: inPersonPaymentLocation,
        }),
        { duration: 8000 }
      );
      prevPaymentRequests.current = pendingPaymentRequests;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pendingPaymentRequests,
    play,
    ready,
    locationId,
    currency,
    inPersonPaymentLocation,
  ]);

  useEffect(() => {
    function onFocus() {
      refreshCounts();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshCounts();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCounts]);

  return (
    <DashboardAlertsContext.Provider
      value={{
        pendingOrders,
        pendingWaiterCalls,
        pendingPaymentRequests,
        totalPendingAlerts:
          pendingOrders + pendingWaiterCalls + pendingPaymentRequests,
        refreshAlerts: refreshCounts,
      }}
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
