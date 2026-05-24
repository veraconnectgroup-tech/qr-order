"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CreditCard, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  buildWaiterTableRows,
  getWaiterTableVisualStatus,
  startOfTodayIso,
  type WaiterTableRow,
  type WaiterTableVisualStatus,
} from "@/lib/dashboard/waiter-table-data";
import { WaiterOrderRow, type WaiterDetailOrder } from "@/components/waiter/waiter-order-row";
import { WaiterTableBillSheet } from "@/components/waiter/waiter-table-bill-sheet";
import { usePullToRefresh } from "@/components/waiter/use-pull-to-refresh";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";
import { dateFnsLocaleForMenu } from "@/lib/i18n/date-fns-locale";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import type { Table, TableSession, Zone } from "@/types";

type Props = {
  tableId: string;
};

const ORDER_SELECT =
  "id, order_number, status, total, created_at, order_items(*, order_item_modifiers(*))";

function tableStatusDot(status: WaiterTableVisualStatus) {
  switch (status) {
    case "free":
      return "bg-emerald-500";
    case "active":
      return "bg-yellow-400";
    case "ready":
      return "bg-orange-500";
    case "call":
      return "bg-red-500";
    case "pending_approval":
      return "bg-blue-500";
  }
}

function tableStatusLabel(
  status: WaiterTableVisualStatus,
  t: ReturnType<typeof useWaiterI18n>["t"]
) {
  switch (status) {
    case "free":
      return t("status.free");
    case "active":
      return t("status.active");
    case "ready":
      return t("status.ready");
    case "call":
      return t("status.call");
    case "pending_approval":
      return t("status.pendingApproval");
  }
}

export function WaiterTableDetail({ tableId }: Props) {
  const { locationId, currency, staffRole } = useDashboard();
  const { t, menuLocale } = useWaiterI18n();
  const waiterCallsResult = useRealtimeWaiterCalls(locationId);
  const [table, setTable] = useState<WaiterTableRow | null>(null);
  const [orders, setOrders] = useState<WaiterDetailOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [billOpen, setBillOpen] = useState(false);

  const canUpdateStatus = !["kitchen"].includes(staffRole);

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
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: sessions } = await supabase
      .from("table_sessions")
      .select("id, table_id, opened_at")
      .eq("location_id", locationId)
      .eq("table_id", tableId)
      .eq("status", "active");

    const session = (sessions ?? [])[0] as
      | Pick<TableSession, "id" | "table_id" | "opened_at">
      | undefined;

    const [{ data: summaryOrdersData }, { data: detailOrdersData }] =
      await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, table_id, session_id, order_number, total, status, created_at, payment_requested_at, payment_status, payment_method"
          )
          .eq("location_id", locationId)
          .eq("table_id", tableId)
          .gte("created_at", startOfTodayIso())
          .neq("status", "rejected")
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("location_id", locationId)
          .eq("table_id", tableId)
          .gte("created_at", startOfTodayIso())
          .neq("status", "rejected")
          .order("created_at", { ascending: false }),
      ]);

    const [row] = buildWaiterTableRows(
      [tableData as unknown as Table & { zone: Zone | null }],
      session ? [session] : [],
      (summaryOrdersData ?? []) as unknown as Array<
        WaiterTableRow["activeOrders"][number] & {
          table_id: string | null;
          session_id: string | null;
        }
      >,
      pendingCallTableIds
    );

    setTable(row ?? null);
    setOrders((detailOrdersData ?? []) as unknown as WaiterDetailOrder[]);
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

  usePostgresRealtime({
    channelName: `waiter-table-detail-calls:${tableId}`,
    table: "waiter_calls",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: load,
    fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  const { bind, indicator, refreshing } = usePullToRefresh({
    onRefresh: load,
    disabled: loading,
    hint: t("pull.hint"),
    release: t("pull.release"),
    refreshingLabel: t("pull.refreshing"),
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
          className="inline-flex min-h-12 items-center gap-2 text-sm text-dash-text-muted active:opacity-70"
          onClick={() => hapticLight()}
        >
          <ArrowLeft className="size-4" />
          {t("table.backToTables")}
        </Link>
        <p className="text-sm text-dash-text-muted">{t("table.notFound")}</p>
      </div>
    );
  }

  const visualStatus = getWaiterTableVisualStatus(table);
  const activeOrders = orders.filter((order) =>
    ["pending", "pending_approval", "accepted", "preparing", "ready"].includes(
      order.status
    )
  );

  return (
    <div {...bind} className={cn(refreshing && "opacity-70 transition-opacity")}>
      {indicator}
      <div className="space-y-5">
      <Link
        href="/waiter"
        className="inline-flex min-h-12 items-center gap-2 text-sm text-dash-text-muted active:opacity-70"
        onClick={() => hapticLight()}
      >
        <ArrowLeft className="size-4" />
        {t("table.backToTables")}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span className={cn("size-3 rounded-full", tableStatusDot(visualStatus))} />
          <h1 className="font-mono text-2xl font-bold text-dash-text">
            {table.name}
          </h1>
        </div>
        <p className="mt-1 text-sm text-dash-text-muted">
          {table.zone?.name ?? t("table.noZone")} ·{" "}
          {tableStatusLabel(visualStatus, t)}
        </p>
      </div>

      {table.hasWaiterCall && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {t("table.guestCalledWaiter")}
        </p>
      )}

      {table.hasPaymentRequest && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
          {t("table.guestRequestedBill")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Button
          asChild
          className="min-h-12 w-full bg-dash-accent text-base font-semibold active:scale-[0.98]"
          onClick={() => hapticLight()}
        >
          <Link href={`/waiter/new-order?tableId=${table.id}`}>
            <UtensilsCrossed className="mr-2 size-5" />
            {t("action.newOrder")}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full border-dash-border-subtle text-base font-semibold active:scale-[0.98]"
          onClick={() => {
            hapticLight();
            setBillOpen(true);
          }}
        >
          <CreditCard className="mr-2 size-5" />
          {t("action.bill")}
        </Button>
      </div>

      {table.session && (
        <div className="rounded-xl border border-dash-border-subtle bg-dash-surface p-4 text-sm text-dash-text-secondary">
          <p>
            {t("session.since", {
              time: new Date(table.session.opened_at).toLocaleTimeString(
                menuLocale === "de" ? "de-DE" : "en-GB",
                { hour: "2-digit", minute: "2-digit" }
              ),
            })}
            {" · "}
            {formatDistanceToNow(new Date(table.session.opened_at), {
              addSuffix: false,
              locale: dateFnsLocaleForMenu(menuLocale),
            })}
          </p>
          <p className="mt-1">
            {activeOrders.length}{" "}
            {t("session.activeOrders").toLowerCase()} ·{" "}
            <span className="font-mono text-lg font-semibold text-dash-accent">
              {formatPrice(table.sessionTotal, currency)}
            </span>
          </p>
        </div>
      )}

      {activeOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dash-border-subtle px-4 py-10 text-center">
          <p className="text-sm text-dash-text-muted">{t("empty.tableFree")}</p>
          <Button
            asChild
            className="mt-4 min-h-12 bg-dash-accent px-6 text-base font-semibold active:scale-[0.98]"
          >
            <Link href={`/waiter/new-order?tableId=${table.id}`}>
              <UtensilsCrossed className="mr-2 size-5" />
              {t("action.newOrder")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            {t("session.activeOrders")}
          </p>
          {activeOrders.map((order) => (
            <WaiterOrderRow
              key={order.id}
              order={order}
              currency={currency}
              canUpdateStatus={canUpdateStatus}
              onUpdated={load}
              onOptimisticStatus={(orderId, status) => {
                setOrders((current) =>
                  status === "delivered"
                    ? current.filter((row) => row.id !== orderId)
                    : current.map((row) =>
                        row.id === orderId ? { ...row, status } : row
                      )
                );
              }}
            />
          ))}
        </div>
      )}

      <WaiterTableBillSheet
        open={billOpen}
        onOpenChange={setBillOpen}
        tableName={table.name}
        sessionId={table.session?.id ?? null}
        onPaid={load}
      />
      </div>
    </div>
  );
}
