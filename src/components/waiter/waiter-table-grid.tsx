"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  buildWaiterTableRows,
  getLastOrderAt,
  getWaiterTableVisualStatus,
  sortWaiterTables,
  startOfTodayIso,
  WAITER_TABLE_STATUS_STYLES,
  type WaiterTableRow,
} from "@/lib/dashboard/waiter-table-data";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import { usePullToRefresh } from "@/components/waiter/use-pull-to-refresh";
import type { Table, TableSession, Zone } from "@/types";

type Props = {
  detailBasePath?: string;
  className?: string;
};

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
        "id, table_id, session_id, order_number, total, status, created_at, payment_requested_at, payment_status, payment_method"
      )
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso())
      .neq("status", "rejected");

    setTables(
      sortWaiterTables(
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

  usePostgresRealtime({
    channelName: `waiter-tables-calls:${locationId}`,
    table: "waiter_calls",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: load,
    fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  const { bind, indicator, refreshing } = usePullToRefresh({
    onRefresh: load,
    disabled: loading,
  });

  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-32 rounded-xl bg-dash-surface-raised"
          />
        ))}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-dash-border-subtle px-4 py-8 text-center text-sm text-dash-text-muted">
        Nema konfigurisanih stolova.
      </p>
    );
  }

  return (
    <div {...bind}>
      {indicator}
      <div
        className={cn(
          "grid grid-cols-2 gap-3 transition-opacity",
          refreshing && "opacity-70",
          className
        )}
      >
        {tables.map((table) => {
          const visualStatus = getWaiterTableVisualStatus(table);
          const styles = WAITER_TABLE_STATUS_STYLES[visualStatus];
          const orderCount = table.activeOrders.length;
          const lastOrderAt = getLastOrderAt(table);

          return (
            <Link
              key={table.id}
              href={`${detailBasePath}/${table.id}`}
              onClick={() => hapticLight()}
              className={cn(
                "flex min-h-[8.5rem] flex-col rounded-xl border bg-dash-surface p-4 transition active:scale-[0.98]",
                styles.border
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xl font-bold text-dash-text">
                    {table.name}
                  </p>
                  <p className="truncate text-xs text-dash-text-muted">
                    {table.zone?.name ?? "Bez zone"}
                  </p>
                </div>
                <span className={cn("mt-1 size-3 shrink-0 rounded-full", styles.dot)} />
              </div>

              <div className="mt-auto space-y-1 pt-3">
                <p className="text-xs font-medium text-dash-text-secondary">
                  {styles.label}
                  {orderCount > 0 && (
                    <span className="text-dash-text-muted">
                      {" "}
                      · {orderCount} nar.
                    </span>
                  )}
                </p>
                {table.sessionTotal > 0 && (
                  <p className="font-mono text-sm font-semibold text-dash-accent">
                    {formatPrice(table.sessionTotal, currency)}
                  </p>
                )}
                {lastOrderAt && (
                  <p className="text-[11px] text-dash-text-disabled">
                    {formatDistanceToNow(new Date(lastOrderAt), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </p>
                )}
                {table.hasPaymentRequest && (
                  <p className="text-[11px] font-medium text-amber-400">
                    Plaćanje zatraženo
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
