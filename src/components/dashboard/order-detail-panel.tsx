"use client";

import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

export function PaymentStatusBadge({
  paymentStatus,
  className,
}: {
  paymentStatus: string;
  className?: string;
}) {
  if (paymentStatus === "refunded") {
    return (
      <span
        className={cn(
          "rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400",
          className
        )}
      >
        Refundiran
      </span>
    );
  }

  if (paymentStatus === "partial_refund") {
    return (
      <span
        className={cn(
          "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400",
          className
        )}
      >
        Partially refunded
      </span>
    );
  }

  if (paymentStatus === "paid") {
    return (
      <span
        className={cn(
          "rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400",
          className
        )}
      >
        Paid ✓
      </span>
    );
  }

  return null;
}

export function OrderDetailPanel({
  order,
  currency,
  staffRole,
  busy,
  onRefund,
  light = false,
}: {
  order: OrderWithDetails;
  currency: string;
  staffRole: string;
  busy?: boolean;
  onRefund?: () => void;
  light?: boolean;
}) {
  const paid = order.payment_status === "paid";
  const refunded =
    order.payment_status === "refunded" ||
    order.payment_status === "partial_refund";
  const canRefund =
    Boolean(onRefund) &&
    paid &&
    order.payment_method === "online" &&
    ["owner", "manager"].includes(staffRole);

  const refundStaff = order.refund_staff;

  return (
    <div className={cn("space-y-2", light ? "text-zinc-700" : "text-zinc-300")}>
      <div className="flex flex-wrap items-center gap-2">
        <PaymentStatusBadge paymentStatus={order.payment_status} />
        {canRefund && (
          <button
            type="button"
            disabled={busy}
            onClick={onRefund}
            className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
          >
            Refund
          </button>
        )}
      </div>

      {refunded && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            light
              ? "border-zinc-200 bg-zinc-50 text-zinc-600"
              : "border-zinc-800 bg-zinc-950/50 text-zinc-400"
          )}
        >
          {order.refund_reason && (
            <p>
              <span className="font-medium text-zinc-300">Razlog:</span>{" "}
              {order.refund_reason}
            </p>
          )}
          {refundStaff?.name && (
            <p className="mt-1">
              <span className="font-medium text-zinc-300">Odobrio:</span>{" "}
              {refundStaff.name}
            </p>
          )}
          {order.refunded_at && (
            <p className="mt-1">
              <span className="font-medium text-zinc-300">Datum:</span>{" "}
              {new Date(order.refunded_at).toLocaleString("de-DE")}
            </p>
          )}
          {order.refund_id && (
            <p className="mt-1 font-mono text-[10px] text-zinc-500">
              {order.refund_id}
            </p>
          )}
        </div>
      )}

      {!refunded && Number(order.tip_amount ?? 0) > 0 && (
        <p className="text-xs text-emerald-400/90">
          Tip · {formatPrice(Number(order.tip_amount), currency)}
          {order.tip_staff?.name ? ` · ${order.tip_staff.name}` : ""}
        </p>
      )}

      {order.is_split && (order.split_payments?.length ?? 0) > 0 && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            light
              ? "border-zinc-200 bg-zinc-50 text-zinc-600"
              : "border-zinc-800 bg-zinc-950/50 text-zinc-400"
          )}
        >
          <p className="font-medium text-zinc-300">
            Split bill ·{" "}
            {
              (order.split_payments ?? []).filter(
                (s) => s.payment_status === "paid"
              ).length
            }{" "}
            of {(order.split_payments ?? []).length} parts paid
          </p>
          <ul className="mt-2 space-y-1">
            {(order.split_payments ?? []).map((split, i) => (
              <li key={split.id} className="flex justify-between gap-2">
                <span>
                  Deo {i + 1}
                  {split.payment_status === "paid" ? " ✓" : ""}
                </span>
                <span className="tabular-nums">
                  {formatPrice(
                    Number(split.amount) + Number(split.tip_amount ?? 0),
                    currency
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!refunded && paid && (
        <div className={cn("space-y-1", light ? "text-zinc-500" : "text-zinc-500")}>
          <p className="text-xs">
            Online payment · {formatPrice(Number(order.total), currency)}
          </p>
        </div>
      )}
    </div>
  );
}
