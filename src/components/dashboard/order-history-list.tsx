"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import {
  revenueEligibleOrders,
  sumOrderRevenue,
} from "@/lib/orders/revenue";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

type DateFilter = "today" | "yesterday" | "week" | "month" | "custom";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name)";

const PAGE_SIZE = 20;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getRange(
  filter: DateFilter,
  customFrom: string,
  customTo: string
): { start: Date; end: Date } {
  const now = new Date();
  const today = startOfDay(now);

  if (filter === "today") {
    return { start: today, end: endOfDay(now) };
  }
  if (filter === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { start: y, end: endOfDay(y) };
  }
  if (filter === "week") {
    const w = new Date(today);
    w.setDate(w.getDate() - 6);
    return { start: w, end: endOfDay(now) };
  }
  if (filter === "month") {
    const m = new Date(today);
    m.setDate(m.getDate() - 29);
    return { start: m, end: endOfDay(now) };
  }
  return {
    start: startOfDay(new Date(customFrom)),
    end: endOfDay(new Date(customTo)),
  };
}

function getPreviousRange(range: { start: Date; end: Date }) {
  const durationMs = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

function inRange(iso: string, range: { start: Date; end: Date }) {
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

type PeriodStats = {
  revenue: number;
  count: number;
  avg: number;
  topItem: string;
  topCount: number;
};

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

function PaymentCell({
  status,
  orderStatus,
}: {
  status: string;
  orderStatus: string;
}) {
  if (status === "paid") {
    return <span className="text-green-400">Paid ✓</span>;
  }
  if (status === "refunded" || status === "partial_refund") {
    return <span className="text-red-400">Refund</span>;
  }
  if (status === "pending" && orderStatus === "delivered") {
    return <span className="text-zinc-400">Pay at counter</span>;
  }
  return <span className="text-yellow-400">Pending</span>;
}

function exportCsv(orders: OrderWithDetails[]) {
  const header =
    "order_number,table,items_count,total,status,payment_status,created_at";
  const rows = orders.map((o) => {
    const items =
      o.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
    return [
      o.order_number,
      o.tables?.name ?? "",
      items,
      o.total,
      o.status,
      o.payment_status,
      o.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  const blob = new Blob([[header, ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrderHistoryList() {
  const { locationId, currency } = useDashboard();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DateFilter>("today");
  const [customFrom, setCustomFrom] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [customTo, setCustomTo] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const fetchFrom = new Date();
    fetchFrom.setDate(fetchFrom.getDate() - 62);

    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .gte("created_at", fetchFrom.toISOString())
      .order("created_at", { ascending: false });

    setOrders((data as unknown as OrderWithDetails[]) ?? []);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const range = useMemo(
    () => getRange(filter, customFrom, customTo),
    [filter, customFrom, customTo]
  );

  const previousRange = useMemo(() => getPreviousRange(range), [range]);

  const filtered = useMemo(
    () => orders.filter((o) => inRange(o.created_at, range)),
    [orders, range]
  );

  const previousFiltered = useMemo(
    () => orders.filter((o) => inRange(o.created_at, previousRange)),
    [orders, previousRange]
  );

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const prevStats = useMemo(
    () => computeStats(previousFiltered),
    [previousFiltered]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [filter, customFrom, customTo]);

  const filters: { id: DateFilter; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "custom", label: "Custom" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-zinc-800" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  }

  const rangeStart = (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => exportCsv(filtered)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <p className="mb-1 text-sm text-zinc-400">{card.label}</p>
            <p className="font-mono text-3xl font-bold text-white">
              {card.value}
              {card.sub}
            </p>
            {card.compare && <div className="mt-2">{card.compare}</div>}
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition",
              filter === f.id
                ? "bg-orange-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            )}
          >
            {f.label}
          </button>
        ))}
        {filter === "custom" && (
          <div className="ml-2 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
            />
            <span className="text-zinc-600">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200"
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Time</th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-zinc-500"
                >
                  No orders in this period
                </td>
              </tr>
            ) : (
              paginated.map((order) => {
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
                      className="cursor-pointer border-b border-zinc-800/50 px-4 py-3 transition hover:bg-zinc-800/30"
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
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentCell
                          status={order.payment_status}
                          orderStatus={order.status}
                        />
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(order.created_at).toLocaleTimeString(
                          "de-DE",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </td>
                      <td className="px-2 py-3 text-zinc-500">
                        {isExpanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-zinc-800/50 bg-zinc-950/50">
                        <td colSpan={8} className="px-6 py-4">
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

      {filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Showing {rangeStart}-{rangeEnd} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
