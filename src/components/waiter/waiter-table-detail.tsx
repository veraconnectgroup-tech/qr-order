"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { formatOrderNumber, formatPrice } from "@/lib/format";
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

function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "preparing":
    case "accepted":
      return "Preparing";
    case "ready":
      return "Ready";
    case "rejected":
      return "Rejected";
    default:
      return "New";
  }
}

type Props = {
  tableId: string;
};

export function WaiterTableDetail({ tableId }: Props) {
  const { locationId, currency } = useDashboard();
  const waiterCallsResult = useRealtimeWaiterCalls(locationId);
  const [table, setTable] = useState<WaiterTableRow | null>(null);
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

    const { data: tableData } = await supabase
      .from("tables")
      .select("*, zone:zones(*)")
      .eq("id", tableId)
      .eq("location_id", locationId)
      .maybeSingle();

    if (!tableData) {
      setTable(null);
      setLoading(false);
      return;
    }

    const { data: sessions } = await supabase
      .from("table_sessions")
      .select("id, table_id, opened_at")
      .eq("location_id", locationId)
      .eq("table_id", tableId)
      .eq("status", "active");

    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, table_id, session_id, order_number, total, status, payment_requested_at, payment_status, payment_method"
      )
      .eq("location_id", locationId)
      .eq("table_id", tableId)
      .gte("created_at", startOfTodayIso())
      .neq("status", "rejected");

    const [row] = buildWaiterTableRows(
      [tableData as unknown as Table & { zone: Zone | null }],
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
    );

    setTable(row ?? null);
    setLoading(false);
  }, [locationId, pendingCallTableIds, tableId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePostgresRealtime({
    channelName: `waiter-table-detail-orders:${tableId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: load,
    fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32 rounded-lg bg-dash-surface-raised" />
        <Skeleton className="h-40 rounded-xl bg-dash-surface-raised" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="space-y-4">
        <Link
          href="/waiter"
          className="inline-flex min-h-12 items-center gap-2 text-sm text-dash-text-muted"
          onClick={() => hapticLight()}
        >
          <ArrowLeft className="size-4" />
          Back to tables
        </Link>
        <p className="text-sm text-dash-text-muted">Table not found.</p>
      </div>
    );
  }

  const status = waiterTableStatus(table);

  return (
    <div className="space-y-5">
      <Link
        href="/waiter"
        className="inline-flex min-h-12 items-center gap-2 text-sm text-dash-text-muted"
        onClick={() => hapticLight()}
      >
        <ArrowLeft className="size-4" />
        All tables
      </Link>

      <div>
        <h1 className="font-mono text-3xl font-bold text-dash-text">
          {table.name}
        </h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          {table.zone?.name ?? "No zone"} · {table.seats} seats ·{" "}
          <span
            className={cn(
              "capitalize",
              status === "attention" && "text-red-400",
              status === "payment" && "text-amber-400",
              status === "occupied" && "text-emerald-400"
            )}
          >
            {status}
          </span>
        </p>
      </div>

      {table.hasPaymentRequest && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
          Guest requested payment — collect bill or use terminal.
        </p>
      )}

      {table.hasWaiterCall && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          Guest called for service.
        </p>
      )}

      <div className="rounded-xl border border-dash-border-subtle bg-dash-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          Active orders
        </p>
        {table.activeOrders.length === 0 ? (
          <p className="mt-3 text-sm text-dash-text-muted">No active orders</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {table.activeOrders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-mono font-semibold text-dash-text">
                  {formatOrderNumber(order.order_number)}
                </span>
                <span className="text-dash-text-muted">
                  {orderStatusLabel(order.status)}
                </span>
                <span className="font-mono text-dash-accent">
                  {formatPrice(Number(order.total), currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {table.sessionTotal > 0 && (
          <p className="mt-4 border-t border-dash-border-subtle pt-4 font-mono text-lg font-semibold text-dash-accent">
            Session total: {formatPrice(table.sessionTotal, currency)}
          </p>
        )}
      </div>

      <Button
        asChild
        className="min-h-12 w-full bg-dash-accent text-base font-semibold hover:bg-dash-accent/90"
        onClick={() => hapticLight()}
      >
        <Link href={`/waiter/new-order?tableId=${table.id}`}>
          <Plus className="mr-2 size-5" />
          New order
        </Link>
      </Button>
    </div>
  );
}
