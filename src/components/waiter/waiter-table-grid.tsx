"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useRealtimeWaiterCalls } from "@/hooks/use-realtime-waiter-calls";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { fetchWaiterTableRows } from "@/lib/dashboard/fetch-waiter-table-rows";
import {
  getLastOrderAt,
  getWaiterTableVisualStatus,
  type WaiterTableRow,
  type WaiterTableVisualStatus,
} from "@/lib/dashboard/waiter-table-data";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import { usePullToRefresh } from "@/components/waiter/use-pull-to-refresh";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";
import { dateFnsLocaleForMenu } from "@/lib/i18n/date-fns-locale";

type Props = {
  detailBasePath?: string;
  className?: string;
};

function tableStatusBorder(status: WaiterTableVisualStatus) {
  switch (status) {
    case "free":
      return "border-dashed border-emerald-500/30 bg-dash-bg/50";
    case "active":
      return "border-yellow-500/50 ring-1 ring-yellow-500/20";
    case "ready":
      return "border-orange-500/60 ring-1 ring-orange-500/25";
    case "call":
      return "animate-pulse border-red-500 ring-1 ring-red-500/30";
    case "pending_approval":
      return "border-blue-500/60 ring-1 ring-blue-500/25";
  }
}

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

export function WaiterTableGrid({
  detailBasePath = "/waiter/tables",
  className,
}: Props) {
  const { locationId, currency } = useDashboard();
  const { t, menuLocale } = useWaiterI18n();
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
    setTables(
      await fetchWaiterTableRows(locationId, pendingCallTableIds)
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
    hint: t("pull.hint"),
    release: t("pull.release"),
    refreshingLabel: t("pull.refreshing"),
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
        {t("empty.noTables")}
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
          const orderCount = table.activeOrders.length;
          const lastOrderAt = getLastOrderAt(table);

          return (
            <Link
              key={table.id}
              href={`${detailBasePath}/${table.id}`}
              onClick={() => hapticLight()}
              className={cn(
                "flex min-h-[8.5rem] flex-col rounded-xl border bg-dash-surface p-4 active:scale-[0.98]",
                tableStatusBorder(visualStatus)
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-2xl font-bold text-dash-text">
                    {table.name}
                  </p>
                  <p className="truncate text-xs text-dash-text-muted">
                    {table.zone?.name ?? t("table.noZone")}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-1 size-3 shrink-0 rounded-full",
                    tableStatusDot(visualStatus)
                  )}
                />
              </div>

              <div className="mt-auto space-y-1 pt-3">
                <p className="text-xs font-medium text-dash-text-secondary">
                  {tableStatusLabel(visualStatus, t)}
                  {orderCount > 0 && (
                    <span className="text-dash-text-muted">
                      {t("table.ordersCount", { count: orderCount })}
                    </span>
                  )}
                </p>
                {table.sessionTotal > 0 && (
                  <p className="font-mono text-lg font-semibold text-dash-accent">
                    {formatPrice(table.sessionTotal, currency)}
                  </p>
                )}
                {lastOrderAt && (
                  <p className="text-[11px] text-dash-text-disabled">
                    {formatDistanceToNow(new Date(lastOrderAt), {
                      addSuffix: true,
                      locale: dateFnsLocaleForMenu(menuLocale),
                    })}
                  </p>
                )}
                {table.hasPaymentRequest && (
                  <p className="text-[11px] font-medium text-amber-400">
                    {t("status.paymentRequested")}
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
