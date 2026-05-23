"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import {
  resolveAnalyticsDateRange,
  type AnalyticsSearchParams,
} from "@/lib/analytics/date-range";
import {
  revenueEligibleOrders,
  sumOrderRevenue,
} from "@/lib/orders/revenue";
import { sumTips } from "@/lib/orders/tips";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { AnalyticsCharts } from "@/components/charts-dynamic";
import { HistoryDateRangePicker } from "@/components/dashboard/history-date-range-picker";
import { RefundOrderDialog } from "@/components/dashboard/refund-order-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { unpaidPaymentHint } from "@/lib/payment-methods";
import { TaxBreakdownLines } from "@/components/shared/tax-breakdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

type PeriodStats = {
  revenue: number;
  count: number;
  avg: number;
  topItem: string;
  topCount: number;
};

function getPreviousRange(range: { start: Date; end: Date }) {
  const durationMs = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

function computeStats(orders: OrderWithDetails[]): PeriodStats {
  const eligible = revenueEligibleOrders(orders);
  const revenue = sumOrderRevenue(orders);
  const avg = eligible.length ? revenue / eligible.length : 0;

  const itemCounts = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.order_items ?? []) {
      itemCounts.set(
        item.product_name,
        (itemCounts.get(item.product_name) ?? 0) + item.quantity
      );
    }
  }

  let topItem = "—";
  let topCount = 0;
  itemCounts.forEach((count, name) => {
    if (count > topCount) {
      topCount = count;
      topItem = name;
    }
  });

  return { revenue, count: orders.length, avg, topItem, topCount };
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function Comparison({
  current,
  previous,
  format,
  currency,
}: {
  current: number;
  previous: number;
  format: "percent" | "currency";
  currency: string;
}) {
  const diff =
    format === "percent"
      ? pctChange(current, previous)
      : current - previous;

  if (diff === 0 && previous === 0 && current === 0) {
    return <span className="text-sm text-zinc-500">—</span>;
  }

  const positive = diff >= 0;
  const arrow = positive ? "↑" : "↓";
  const text =
    format === "percent"
      ? `${positive ? "+" : ""}${diff.toFixed(0)}% ${arrow}`
      : `${positive ? "+" : ""}${formatPrice(diff, currency)} ${arrow}`;

  return (
    <span
      className={cn(
        "text-sm",
        positive ? "text-green-400" : "text-red-400"
      )}
    >
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "New"
      : status === "accepted"
        ? "Preparing"
        : status.charAt(0).toUpperCase() + status.slice(1);

  const styles: Record<string, string> = {
    delivered: "bg-green-500/10 text-green-400",
    preparing: "bg-yellow-500/10 text-yellow-400",
    accepted: "bg-yellow-500/10 text-yellow-400",
    rejected: "bg-red-500/10 text-red-400",
    pending: "bg-orange-500/10 text-orange-400",
    ready: "bg-green-500/10 text-green-400",
    cancelled: "bg-zinc-500/10 text-zinc-400",
  };

  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-zinc-800 text-zinc-400"
      )}
    >
      {label}
    </span>
  );
}

function RefundStatusBadge({
  paymentStatus,
}: {
  paymentStatus: string;
}) {
  if (paymentStatus === "refunded") {
    return (
      <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
        Refunded
      </span>
    );
  }
  if (paymentStatus === "partial_refund") {
    return (
      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
        Partial refund
      </span>
    );
  }
  return null;
}

function PaymentCell({
  status,
  orderStatus,
  paymentMethod,
  inPersonPaymentLocation,
}: {
  status: string;
  orderStatus: string;
  paymentMethod?: string | null;
  inPersonPaymentLocation: "bar" | "counter" | "table";
}) {
  if (status === "paid") {
    return <span className="text-green-400">Paid ✓</span>;
  }
  if (status === "refunded") {
    return <span className="text-red-400">Refunded</span>;
  }
  if (status === "partial_refund") {
    return <span className="text-amber-400">Partially refunded</span>;
  }
  if (status === "pending" && orderStatus === "delivered") {
    return (
      <span className="text-zinc-400">
        {unpaidPaymentHint(paymentMethod ?? "at_bar", inPersonPaymentLocation)}
      </span>
    );
  }
  return <span className="text-yellow-400">Pending</span>;
}

function getRefundAmount(order: OrderWithDetails): number | null {
  const entry = order.audit_log
    ?.filter((a) => a.action === "refund")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  if (entry?.amount != null) return Number(entry.amount);
  if (
    order.payment_status === "refunded" ||
    order.payment_status === "partial_refund"
  ) {
    return Number(order.total);
  }
  return null;
}

function RefundCell({
  order,
  currency,
}: {
  order: OrderWithDetails;
  currency: string;
}) {
  if (
    order.payment_status !== "refunded" &&
    order.payment_status !== "partial_refund"
  ) {
    return <span className="text-zinc-600">—</span>;
  }

  const amount = getRefundAmount(order);

  return (
    <div className="text-xs text-zinc-400">
      {amount != null && (
        <p className="font-mono text-zinc-300">
          {formatPrice(amount, currency)}
        </p>
      )}
      {order.refund_reason && (
        <p className="mt-0.5 max-w-[180px] truncate" title={order.refund_reason}>
          {order.refund_reason}
        </p>
      )}
      {order.refund_staff?.name && (
        <p className="mt-0.5">{order.refund_staff.name}</p>
      )}
      {order.refunded_at && (
        <p className="mt-0.5 text-zinc-500">
          {new Date(order.refunded_at).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}

function OrderRowActions({
  order,
  staffRole,
  onRefund,
  onResent,
}: {
  order: OrderWithDetails;
  staffRole: string;
  onRefund: () => void;
  onResent: () => void;
}) {
  const canRefund =
    order.payment_status === "paid" &&
    order.payment_method === "online" &&
    ["owner", "manager"].includes(staffRole);
  const guestEmail = order.table_sessions?.guest_email;
  const canResend = Boolean(guestEmail) && ["owner", "manager"].includes(staffRole);

  if (!canRefund && !canResend) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Order actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-zinc-700 bg-zinc-900 text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {canRefund ? (
          <DropdownMenuItem
            className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-50"
            onClick={onRefund}
          >
            <RotateCcw className="mr-2 size-4" />
            Issue refund
          </DropdownMenuItem>
        ) : null}
        {canResend ? (
          <DropdownMenuItem
            className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-50"
            onClick={onResent}
          >
            <Mail className="mr-2 size-4" />
            Resend receipt
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrderHistoryListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-full max-w-4xl rounded-lg bg-zinc-800" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-zinc-800" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl bg-zinc-800" />
    </div>
  );
}

export function OrderHistoryList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, inPersonPaymentLocation, staffRole } = useDashboard();

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [statsOrders, setStatsOrders] = useState<OrderWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<OrderWithDetails | null>(
    null
  );
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [resendingId, setResendingId] = useState<string | null>(null);

  const queryString = searchParams.toString();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;

  const rangeParams = useMemo(
    (): AnalyticsSearchParams => ({
      preset: searchParams.get("preset") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
    [searchParams]
  );
  const range = useMemo(
    () => resolveAnalyticsDateRange(rangeParams),
    [rangeParams]
  );
  const previousRange = useMemo(() => getPreviousRange(range), [range]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      router.push(`/dashboard/history?${next.toString()}`);
    },
    [router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/history?${queryString}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load history");
      }
      setOrders(json.data.orders ?? []);
      setStatsOrders(json.data.statsOrders ?? []);
      setTotal(json.data.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load history");
      setOrders([]);
      setStatsOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSearchInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (searchInput.trim() === current.trim()) return;
      updateParams({ q: searchInput.trim() || null });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams, updateParams]);

  const stats = useMemo(() => computeStats(statsOrders), [statsOrders]);
  const totalTips = useMemo(() => sumTips(statsOrders), [statsOrders]);
  const previousFiltered = useMemo(
    () =>
      statsOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return (
          t >= previousRange.start.getTime() &&
          t <= previousRange.end.getTime()
        );
      }),
    [statsOrders, previousRange]
  );
  const prevStats = useMemo(
    () => computeStats(previousFiltered),
    [previousFiltered]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);

  const canExport = ["owner", "manager"].includes(staffRole);

  async function handleRefund(orderId: string, reason: string, amount?: number) {
    const res = await fetch(`/api/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, amount }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Refund failed");
    }
    toast.success("Refund issued");
    await load();
  }

  async function handleResendReceipt(orderId: string) {
    setResendingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/resend-receipt`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not send receipt");
      }
      toast.success("Receipt sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send receipt");
    } finally {
      setResendingId(null);
    }
  }

  if (loading && orders.length === 0) {
    return <OrderHistoryListSkeleton />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <HistoryDateRangePicker />

        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(value) => updateParams({ status: value === "all" ? null : value })}
        >
          <SelectTrigger className="min-h-11 w-full border-zinc-700 bg-zinc-900 text-zinc-200 sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("payment") ?? "all"}
          onValueChange={(value) =>
            updateParams({ payment: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="min-h-11 w-full border-zinc-700 bg-zinc-900 text-zinc-200 sm:w-[150px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectItem value="all">All payment</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="at_bar">At bar</SelectItem>
            <SelectItem value="card_at_table">Card at table</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("source") ?? "all"}
          onValueChange={(value) =>
            updateParams({ source: value === "all" ? null : value })
          }
        >
          <SelectTrigger className="min-h-11 w-full border-zinc-700 bg-zinc-900 text-zinc-200 sm:w-[130px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-h-11 flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Order #, table, email…"
            className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-10 pr-3 text-sm text-zinc-200 outline-none focus:border-orange-500"
          />
        </div>

        {canExport ? (
          <a
            href={`/api/export/csv?${queryString.replace(/(^|&)page=[^&]*/g, "").replace(/^&/, "")}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 touch-manipulation"
          >
            <Download className="size-4" />
            Export CSV
          </a>
        ) : null}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {[
          {
            label: "Revenue",
            value: formatPrice(stats.revenue, currency),
            compare: (
              <Comparison
                current={stats.revenue}
                previous={prevStats.revenue}
                format="percent"
                currency={currency}
              />
            ),
          },
          {
            label: "Orders",
            value: String(stats.count),
            compare: (
              <Comparison
                current={stats.count}
                previous={prevStats.count}
                format="percent"
                currency={currency}
              />
            ),
          },
          {
            label: "Avg Order",
            value: formatPrice(stats.avg, currency),
            compare: (
              <Comparison
                current={stats.avg}
                previous={prevStats.avg}
                format="currency"
                currency={currency}
              />
            ),
          },
          {
            label: "Top Item",
            value: stats.topItem,
            sub:
              stats.topCount > 0 ? (
                <span className="text-sm font-normal text-zinc-500">
                  ({stats.topCount})
                </span>
              ) : null,
            compare: null,
          },
          {
            label: "Total tips",
            value: formatPrice(totalTips, currency),
            sub: null,
            compare: null,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6"
          >
            <p className="mb-1 text-sm text-zinc-400">{card.label}</p>
            <p className="font-mono text-2xl font-bold text-white sm:text-3xl">
              {card.value}
              {card.sub}
            </p>
            {card.compare && <div className="mt-2">{card.compare}</div>}
          </div>
        ))}
      </div>

      <AnalyticsCharts orders={statsOrders} range={range} currency={currency} />

      <div className="space-y-3 md:hidden">
        {orders.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 text-center text-zinc-500">
            No orders match these filters
          </p>
        ) : (
          orders.map((order) => {
            const itemCount =
              order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
            const isExpanded = expandedId === order.id;

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50"
              >
                <div className="flex items-start gap-2 p-4">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : order.id)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-mono font-semibold text-zinc-50">
                      {formatOrderNumber(order.order_number)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {order.tables?.name ?? "—"} · {itemCount} items
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={order.status} />
                      <RefundStatusBadge paymentStatus={order.payment_status} />
                      <PaymentCell
                        status={order.payment_status}
                        orderStatus={order.status}
                        paymentMethod={order.payment_method}
                        inPersonPaymentLocation={inPersonPaymentLocation}
                      />
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="font-mono font-semibold text-zinc-200">
                      {formatPrice(Number(order.total), currency)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(order.created_at).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <OrderRowActions
                    order={order}
                    staffRole={staffRole}
                    onRefund={() => setRefundTarget(order)}
                    onResent={() => handleResendReceipt(order.id)}
                  />
                </div>
                {isExpanded && (
                  <ul className="space-y-2 border-t border-zinc-800 px-4 py-3">
                    {order.order_items?.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 text-sm text-zinc-300"
                      >
                        <span className="min-w-0">
                          {item.quantity}× {item.product_name}
                        </span>
                        <span className="shrink-0 font-mono text-zinc-400">
                          {formatPrice(Number(item.total), currency)}
                        </span>
                      </li>
                    ))}
                    {(order.order_items?.length ?? 0) > 0 && (
                      <li className="border-t border-zinc-800 pt-2">
                        <TaxBreakdownLines
                          items={(order.order_items ?? []).map((item) => ({
                            total: Number(item.total),
                            tax_rate: Number(item.tax_rate ?? 19),
                          }))}
                          currency={currency}
                        />
                      </li>
                    )}
                    {(order.payment_status === "refunded" ||
                      order.payment_status === "partial_refund") && (
                      <li className="border-t border-zinc-800 pt-2">
                        <RefundCell order={order} currency={currency} />
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Refund</th>
              <th className="px-4 py-3">Time</th>
              <th className="w-12 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-zinc-500"
                >
                  No orders match these filters
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const itemCount =
                  order.order_items?.reduce((s, i) => s + i.quantity, 0) ??
                  0;
                const isExpanded = expandedId === order.id;

                return (
                  <Fragment key={order.id}>
                    <tr
                      onClick={() =>
                        setExpandedId(isExpanded ? null : order.id)
                      }
                      className="cursor-pointer border-b border-zinc-800/50 transition hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-50">
                        {formatOrderNumber(order.order_number)}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {order.tables?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{itemCount}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        {formatPrice(Number(order.total), currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge status={order.status} />
                          <RefundStatusBadge
                            paymentStatus={order.payment_status}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentCell
                          status={order.payment_status}
                          orderStatus={order.status}
                          paymentMethod={order.payment_method}
                          inPersonPaymentLocation={inPersonPaymentLocation}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <RefundCell order={order} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(order.created_at).toLocaleTimeString(
                          "de-DE",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <OrderRowActions
                          order={order}
                          staffRole={staffRole}
                          onRefund={() => setRefundTarget(order)}
                          onResent={() => handleResendReceipt(order.id)}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-zinc-800/50 bg-zinc-950/50">
                        <td colSpan={9} className="px-6 py-4">
                          <ul className="space-y-2">
                            {order.order_items?.map((item) => (
                              <li
                                key={item.id}
                                className="flex justify-between text-sm text-zinc-300"
                              >
                                <span>
                                  {item.quantity}× {item.product_name}
                                  {item.order_item_modifiers?.map((m) => (
                                    <span
                                      key={m.id}
                                      className="block pl-4 text-zinc-500"
                                    >
                                      + {m.modifier_name}
                                    </span>
                                  ))}
                                </span>
                                <span className="font-mono text-zinc-400">
                                  {formatPrice(Number(item.total), currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {(order.order_items?.length ?? 0) > 0 && (
                            <TaxBreakdownLines
                              items={(order.order_items ?? []).map((item) => ({
                                total: Number(item.total),
                                tax_rate: Number(item.tax_rate ?? 19),
                              }))}
                              currency={currency}
                              className="mt-3 border-t border-zinc-800 pt-3"
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Showing {rangeStart}-{rangeEnd} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => updateParams({ page: String(safePage - 1) }, false)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => updateParams({ page: String(safePage + 1) }, false)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <RefundOrderDialog
        open={!!refundTarget}
        orderNumber={refundTarget?.order_number ?? 0}
        orderTotal={Number(refundTarget?.total ?? 0)}
        currency={currency}
        onClose={() => setRefundTarget(null)}
        onConfirm={async (reason, amount) => {
          if (!refundTarget) return;
          await handleRefund(refundTarget.id, reason, amount);
        }}
      />

      {resendingId ? (
        <span className="sr-only" aria-live="polite">
          Sending receipt…
        </span>
      ) : null}
    </div>
  );
}
