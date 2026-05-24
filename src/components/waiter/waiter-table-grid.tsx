"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  buildWaiterTableRows,
  startOfTodayIso,
  waiterTableStatus,
  type WaiterTableRow,
} from "@/lib/dashboard/waiter-table-data";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import type { Table, TableSession, Zone } from "@/types";

type Props = {
  detailBasePath?: string;
  className?: string;
};

function TableSessionTimer({ openedAt }: { openedAt: string }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const ms = Date.now() - new Date(openedAt).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <p className="mt-1 font-mono text-xs tabular-nums text-emerald-400/90">
      {label}
    </p>
  );
}

export function WaiterTableGrid({
  detailBasePath = "/waiter/tables",
  className,
}: Props) {
  const { locationId, currency } = useDashboard();
  const waiterCallsResult = useRealtimeWaiterCalls(locationId);
  const [tables, setTables] = useState<WaiterTableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const pendingCallTableIds = useMemo(
    () =>
      new Set(
        waiterCallsResult.calls
          .filter((call) => call.status === "pending")
          .map((call) => call.table_id)
      ),
    [waiterCallsResult.calls]
  );

  const load = useCallback(async () => {
    const supabase = createClient();

    const { data: tablesData } = await supabase
      .from("tables")
      .select("*, zone:zones(*)")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name");

    const { data: sessions } = await supabase
      .from("table_sessions")
      .select("id, table_id, opened_at")
      .eq("location_id", locationId)
      .eq("status", "active");

    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, table_id, session_id, order_number, total, status, payment_requested_at, payment_status, payment_method"
      )
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso())
      .neq("status", "rejected");

    setTables(
      buildWaiterTableRows(
        (tablesData ?? []) as unknown as Array<Table & { zone: Zone | null }>,
        (sessions ?? []) as Array<
          Pick<TableSession, "id" | "table_id" | "opened_at">
        >,
        (orders ?? []) as Array<
          WaiterTableRow["activeOrders"][number] & {
            table_id: string | null;
            session_id: string | null;
          }
        >,
        pendingCallTableIds
      )
    );
    setLoading(false);
  }, [locationId, pendingCallTableIds]);

  useEffect(() => {
    void load();
  }, [load]);

  usePostgresRealtime({
    channelName: `waiter-tables-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: load,
    fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-28 rounded-xl bg-dash-surface-raised"
          />
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-dash-border-subtle px-4 py-8 text-center text-sm text-dash-text-muted">
        No tables configured for this location.
      </p>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {tables.map((table) => {
        const status = waiterTableStatus(table);
        const orderCount = table.activeOrders.length;

        return (
          <Link
            key={table.id}
            href={`${detailBasePath}/${table.id}`}
            onClick={() => hapticLight()}
            className={cn(
              "flex min-h-[7rem] flex-col items-center justify-center rounded-xl border bg-dash-surface p-4 text-center transition active:scale-[0.98]",
              status === "available" &&
                "border-dashed border-dash-surface-overlay bg-dash-bg/50",
              status === "attention" &&
                "animate-pulse border-red-500 ring-1 ring-red-500/30",
              status === "payment" &&
                "animate-pulse border-amber-500 ring-1 ring-amber-500/30",
              status === "occupied" &&
                "border-emerald-500/40 ring-1 ring-emerald-500/30"
            )}
          >
            <p className="font-mono text-xl font-bold text-dash-text">
              {table.name}
            </p>
            {table.session && (
              <TableSessionTimer openedAt={table.session.opened_at} />
            )}
            {status === "attention" ? (
              <p className="mt-2 text-xs font-medium text-red-400">Call</p>
            ) : status === "payment" ? (
              <p className="mt-2 text-xs font-medium text-amber-400">Pay</p>
            ) : orderCount > 0 ? (
              <p className="mt-2 text-xs text-emerald-400">
                {orderCount} order{orderCount === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="mt-2 text-xs text-dash-text-disabled">Free</p>
            )}
            {table.sessionTotal > 0 && (
              <p className="mt-1 font-mono text-sm font-semibold text-dash-accent">
                {formatPrice(table.sessionTotal, currency)}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
