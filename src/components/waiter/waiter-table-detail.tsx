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
  TABLE_WITH_ZONE_SELECT,
  WAITER_DETAIL_ORDER_SELECT,
  WAITER_SUMMARY_ORDER_SELECT,
  tableWithZoneRows,
} from "@/lib/supabase/query-rows";
import {
  buildWaiterTableRows,
  getWaiterTableVisualStatus,
  parseWaiterDetailOrders,
  parseWaiterSummaryOrders,
  startOfTodayIso,
  type WaiterTableRow,
  type WaiterTableVisualStatus,
} from "@/lib/dashboard/waiter-table-data";
import { WaiterOrderRow, type WaiterDetailOrder } from "@/components/waiter/waiter-order-row";
import {
  attachStationStates,
  fetchOrderStationStates,
} from "@/lib/orders/fetch-order-station-states";
import { WaiterTableBillSheet } from "@/components/waiter/waiter-table-bill-sheet";
import { WaiterQuickActions } from "@/components/waiter/waiter-quick-actions";
import { WaiterTableSessionDenis } from "@/components/waiter/waiter-table-session-denis";
import { WaiterBusTableBanner } from "@/components/waiter/waiter-bus-table-banner";
import { useTableBusObligation } from "@/hooks/use-table-bus-obligations";
import { usePullToRefresh } from "@/components/waiter/use-pull-to-refresh";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";
import { dateFnsLocaleForMenu } from "@/lib/i18n/date-fns-locale";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import type { TableSession } from "@/types";

type Props = {
  tableId: string;
};

const ORDER_SELECT = WAITER_DETAIL_ORDER_SELECT;

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
  const {
    obligation: busObligation,
    refetch: refetchBusObligation,
  } = useTableBusObligation(tableId);

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
      .select(TABLE_WITH_ZONE_SELECT)
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
          .select(WAITER_SUMMARY_ORDER_SELECT)
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

    const tableRows = tableWithZoneRows(tableData ? [tableData] : []);
    const [row] = buildWaiterTableRows(
      tableRows,
      session ? [session] : [],
      parseWaiterSummaryOrders(summaryOrdersData),
      pendingCallTableIds
    );

    setTable(row ?? null);
    const parsed = parseWaiterDetailOrders(detailOrdersData);
    const stationRows = await fetchOrderStationStates(
      supabase,
      parsed.map((entry) => entry.id)
    );
    setOrders(attachStationStates(parsed, stationRows));
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
    channelName: `waiter-table-detail-stations:${tableId}`,
    table: "order_station_states",
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

      {busObligation && (
        <WaiterBusTableBanner
          obligation={busObligation}
          tableName={table.name}
          onCompleted={() => void refetchBusObligation()}
          labels={{
            title: t("table.busTitle"),
            cta: t("table.busCta"),
            waitSuffix: t("table.busWaitSuffix"),
          }}
        />
      )}

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

      <WaiterQuickActions tableId={table.id} tableName={table.name} />

      <WaiterTableSessionDenis tableId={table.id} />

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
              onOptimisticStationStatus={(
                orderId,
                station,
                status,
                globalStatus
              ) => {
                setOrders((current) =>
                  globalStatus === "delivered"
                    ? current.filter((row) => row.id !== orderId)
                    : current.map((row) => {
                        if (row.id !== orderId) return row;
                        const station_states = (row.station_states ?? []).map(
                          (entry) =>
                            entry.station === station
                              ? {
                                  ...entry,
                                  status: status as typeof entry.status,
                                }
                              : entry
                        );
                        return {
                          ...row,
                          station_states,
                          ...(globalStatus ? { status: globalStatus } : {}),
                        };
                      })
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
