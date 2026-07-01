"use client";

import {
  Mail,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { unpaidPaymentHint } from "@/lib/payment-methods";
import { pctChange } from "@/components/dashboard/order-history-list/stats";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

export function OrderHistoryComparison({
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
    return <span className="text-sm text-dash-text-disabled">—</span>;
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

export function OrderHistoryStatusBadge({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "New"
      : status === "accepted"
        ? "Preparing"
        : status === "cancelled"
          ? "Storniert"
          : status.charAt(0).toUpperCase() + status.slice(1);

  const styles: Record<string, string> = {
    delivered: "bg-green-500/10 text-green-400",
    preparing: "bg-yellow-500/10 text-yellow-400",
    accepted: "bg-yellow-500/10 text-yellow-400",
    rejected: "bg-red-500/10 text-red-400",
    pending: "bg-dash-accent-muted text-dash-accent",
    ready: "bg-green-500/10 text-green-400",
    cancelled: "bg-dash-text-muted/10 text-dash-text-muted",
  };

  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-dash-surface-raised text-dash-text-muted"
      )}
    >
      {label}
    </span>
  );
}

export function OrderHistoryRefundStatusBadge({
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

export function OrderHistoryPaymentCell({
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
      <span className="text-dash-text-muted">
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

export function OrderHistoryRefundCell({
  order,
  currency,
}: {
  order: OrderWithDetails;
  currency: string;
}) {
  const isStorno =
    order.status === "cancelled" || order.status === "rejected";
  const hasRefund =
    order.payment_status === "refunded" ||
    order.payment_status === "partial_refund";

  if (!isStorno && !hasRefund) {
    return <span className="text-dash-text-disabled">—</span>;
  }

  const amount = getRefundAmount(order);

  return (
    <div className="text-xs text-dash-text-muted">
      {isStorno && order.rejection_reason && (
        <p
          className="max-w-[180px] truncate text-red-400/90"
          title={order.rejection_reason}
        >
          Storno: {order.rejection_reason}
        </p>
      )}
      {hasRefund && amount != null && (
        <p className="font-mono text-dash-text-secondary">
          {formatPrice(amount, currency)}
        </p>
      )}
      {order.refund_reason && (
        <p className="mt-0.5 max-w-[180px] truncate" title={order.refund_reason}>
          Refund: {order.refund_reason}
        </p>
      )}
      {order.refund_staff?.name && (
        <p className="mt-0.5">{order.refund_staff.name}</p>
      )}
      {order.refunded_at && (
        <p className="mt-0.5 text-dash-text-disabled">
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

export function OrderHistoryRowActions({
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dash-text-muted hover:bg-dash-surface-raised hover:text-dash-text-secondary"
          aria-label="Order actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-dash-surface-overlay bg-dash-surface text-dash-text"
        onClick={(e) => e.stopPropagation()}
      >
        {canRefund ? (
          <DropdownMenuItem
            className="cursor-pointer focus:bg-dash-surface-raised focus:text-dash-text"
            onClick={onRefund}
          >
            <RotateCcw className="mr-2 size-4" />
            Issue refund
          </DropdownMenuItem>
        ) : null}
        {canResend ? (
          <DropdownMenuItem
            className="cursor-pointer focus:bg-dash-surface-raised focus:text-dash-text"
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
