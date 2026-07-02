"use client";

import { Fragment } from "react";
import { Download, Search } from "lucide-react";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { AnalyticsCharts } from "@/components/charts-dynamic";
import { HistoryDateRangePicker } from "@/components/dashboard/history-date-range-picker";
import {
  OrderHistoryComparison,
  OrderHistoryPaymentCell,
  OrderHistoryRefundCell,
  OrderHistoryRefundStatusBadge,
  OrderHistoryRowActions,
  OrderHistoryStatusBadge,
} from "@/components/dashboard/order-history-list/order-history-row-parts";
import { RefundOrderDialog } from "@/components/dashboard/refund-order-dialog";
import { OrderTimelinePanel } from "@/components/dashboard/order-timeline-panel";
import { TaxBreakdownLines } from "@/components/shared/tax-breakdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderHistoryListState } from "@/hooks/use-order-history-list";

export function OrderHistoryListShell({ state }: { state: OrderHistoryListState }) {
  const {
    currency,
    inPersonPaymentLocation,
    staffRole,
    orders,
    statsOrders,
    total,
    expandedId,
    setExpandedId,
    refundTarget,
    setRefundTarget,
    searchInput,
    setSearchInput,
    resendingId,
    searchParams,
    queryString,
    range,
    updateParams,
    stats,
    totalTips,
    prevStats,
    totalPages,
    safePage,
    rangeStart,
    rangeEnd,
    canExport,
    handleRefund,
    handleResendReceipt,
  } = state;

  return (
<div>
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <HistoryDateRangePicker />

        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(value) => updateParams({ status: value === "all" ? null : value })}
        >
          <SelectTrigger className="min-h-11 w-full border-dash-surface-overlay bg-dash-surface text-dash-text-secondary sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
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
          <SelectTrigger className="min-h-11 w-full border-dash-surface-overlay bg-dash-surface text-dash-text-secondary sm:w-[150px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
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
          <SelectTrigger className="min-h-11 w-full border-dash-surface-overlay bg-dash-surface text-dash-text-secondary sm:w-[130px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent className="border-dash-surface-overlay bg-dash-surface text-dash-text">
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-h-11 flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-text-disabled" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Order #, table, email…"
            className="h-11 w-full rounded-lg border border-dash-surface-overlay bg-dash-surface py-2 pl-10 pr-3 text-sm text-dash-text-secondary outline-none focus:border-dash-accent"
          />
        </div>

        {canExport ? (
          <a
            href={`/api/export/csv?${queryString.replace(/(^|&)page=[^&]*/g, "").replace(/^&/, "")}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-dash-surface-raised px-4 py-2 text-sm text-dash-text-secondary transition hover:bg-dash-surface-overlay touch-manipulation"
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
              <OrderHistoryComparison
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
              <OrderHistoryComparison
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
              <OrderHistoryComparison
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
                <span className="text-sm font-normal text-dash-text-disabled">
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
            className="rounded-xl border border-dash-border bg-dash-surface p-4 sm:p-6"
          >
            <p className="mb-1 text-sm text-dash-text-muted">{card.label}</p>
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
          <p className="rounded-xl border border-dash-border bg-dash-surface/50 py-12 text-center text-dash-text-disabled">
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
                className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface/50"
              >
                <div className="flex items-start gap-2 p-4">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : order.id)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-mono font-semibold text-dash-text">
                      {formatOrderNumber(order.order_number)}
                    </p>
                    <p className="mt-1 text-sm text-dash-text-muted">
                      {order.tables?.name ?? "—"} · {itemCount} items
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <OrderHistoryStatusBadge status={order.status} />
                      <OrderHistoryRefundStatusBadge paymentStatus={order.payment_status} />
                      <OrderHistoryPaymentCell
                        status={order.payment_status}
                        orderStatus={order.status}
                        paymentMethod={order.payment_method}
                        inPersonPaymentLocation={inPersonPaymentLocation}
                      />
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="font-mono font-semibold text-dash-text-secondary">
                      {formatPrice(Number(order.total), currency)}
                    </p>
                    <p className="mt-1 text-xs text-dash-text-disabled">
                      {new Date(order.created_at).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <OrderHistoryRowActions
                    order={order}
                    staffRole={staffRole}
                    onRefund={() => setRefundTarget(order)}
                    onResent={() => handleResendReceipt(order.id)}
                  />
                </div>
                {isExpanded && (
                  <ul className="space-y-2 border-t border-dash-border px-4 py-3">
                    {order.order_items?.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-3 text-sm text-dash-text-secondary"
                      >
                        <span className="min-w-0">
                          {item.quantity}× {item.product_name}
                        </span>
                        <span className="shrink-0 font-mono text-dash-text-muted">
                          {formatPrice(Number(item.total), currency)}
                        </span>
                      </li>
                    ))}
                    {(order.order_items?.length ?? 0) > 0 && (
                      <li className="border-t border-dash-border pt-2">
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
                      order.payment_status === "partial_refund" ||
                      order.status === "cancelled" ||
                      order.status === "rejected") && (
                      <li className="border-t border-dash-border pt-2">
                        <OrderHistoryRefundCell order={order} currency={currency} />
                      </li>
                    )}
                    <li className="border-t border-dash-border pt-2">
                      <OrderTimelinePanel orderId={order.id} />
                    </li>
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-dash-border bg-dash-surface/50 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dash-surface-raised/50 text-left text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
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
                  className="px-4 py-12 text-center text-dash-text-disabled"
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
                      className="cursor-pointer border-b border-dash-border transition hover:bg-dash-surface-raised/30"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-dash-text">
                        {formatOrderNumber(order.order_number)}
                      </td>
                      <td className="px-4 py-3 text-dash-text-secondary">
                        {order.tables?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-dash-text-secondary">{itemCount}</td>
                      <td className="px-4 py-3 font-mono text-dash-text-secondary">
                        {formatPrice(Number(order.total), currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <OrderHistoryStatusBadge status={order.status} />
                          <OrderHistoryRefundStatusBadge
                            paymentStatus={order.payment_status}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <OrderHistoryPaymentCell
                          status={order.payment_status}
                          orderStatus={order.status}
                          paymentMethod={order.payment_method}
                          inPersonPaymentLocation={inPersonPaymentLocation}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <OrderHistoryRefundCell order={order} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-dash-text-disabled">
                        {new Date(order.created_at).toLocaleTimeString(
                          "de-DE",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <OrderHistoryRowActions
                          order={order}
                          staffRole={staffRole}
                          onRefund={() => setRefundTarget(order)}
                          onResent={() => handleResendReceipt(order.id)}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-dash-border bg-dash-bg/50">
                        <td colSpan={9} className="px-6 py-4">
                          <ul className="space-y-2">
                            {order.order_items?.map((item) => (
                              <li
                                key={item.id}
                                className="flex justify-between text-sm text-dash-text-secondary"
                              >
                                <span>
                                  {item.quantity}× {item.product_name}
                                  {item.order_item_modifiers?.map((m) => (
                                    <span
                                      key={m.id}
                                      className="block pl-4 text-dash-text-disabled"
                                    >
                                      + {m.modifier_name}
                                    </span>
                                  ))}
                                </span>
                                <span className="font-mono text-dash-text-muted">
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
                              className="mt-3 border-t border-dash-border pt-3"
                            />
                          )}
                          <OrderTimelinePanel orderId={order.id} className="mt-3" />
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
          <p className="text-sm text-dash-text-disabled">
            Showing {rangeStart}-{rangeEnd} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => updateParams({ page: String(safePage - 1) }, false)}
              className="rounded-lg bg-dash-surface-raised px-3 py-1.5 text-sm text-dash-text-secondary disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => updateParams({ page: String(safePage + 1) }, false)}
              className="rounded-lg bg-dash-surface-raised px-3 py-1.5 text-sm text-dash-text-secondary disabled:opacity-50"
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
