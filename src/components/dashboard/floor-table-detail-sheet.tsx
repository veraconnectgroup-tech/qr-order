"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { X } from "lucide-react";
import { DenisTurnInspector } from "@/components/dashboard/denis-turn-inspector";
import {
  floorViewStatusColor,
  floorViewStatusLabel,
  type FloorTableRow,
} from "@/lib/dashboard/floor-status";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function orderStatusLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "preparing":
    case "accepted":
      return "Preparing";
    case "ready":
      return "Ready";
    case "pending":
    case "pending_approval":
      return "New";
    default:
      return status;
  }
}

export function FloorTableDetailSheet({
  table,
  currency,
  onClose,
}: {
  table: FloorTableRow;
  currency: string;
  onClose: () => void;
}) {
  const colors = floorViewStatusColor[table.status];

  return (
    <motion.aside
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl border-t border-dash-border bg-dash-surface p-4 text-dash-text sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(100%,420px)] sm:rounded-none sm:border-l sm:border-t-0 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-wide">
            {table.name}
          </h2>
          <p className={cn("mt-1 text-sm font-medium", colors.text)}>
            <span
              className={cn("me-1.5 inline-block size-2 rounded-full", colors.dot)}
            />
            {floorViewStatusLabel[table.status]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-raised hover:text-dash-text"
        >
          <X className="size-5" />
        </button>
      </div>

      {table.zoneName ? (
        <p className="mt-2 text-sm text-dash-text-muted">Zone: {table.zoneName}</p>
      ) : null}

      {table.sessionTotal != null && table.sessionTotal > 0 ? (
        <p className="mt-2 font-mono text-sm text-[var(--qr-ember)]">
          Session {formatPrice(table.sessionTotal, currency)}
        </p>
      ) : null}

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
          Active orders
        </p>
        {table.activeOrders.length === 0 ? (
          <p className="text-sm text-dash-text-disabled">No active orders</p>
        ) : (
          <ul className="space-y-2">
            {table.activeOrders.map((order, index) => (
              <li
                key={`${order.status}-${index}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-dash-text-muted">
                  {orderStatusLabel(order.status)}
                </span>
                {order.total != null ? (
                  <span className="font-mono text-dash-text-secondary">
                    {formatPrice(Number(order.total), currency)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {table.aiSessionId ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-disabled">
            Denis conversation
          </p>
          <DenisTurnInspector sessionId={table.aiSessionId} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-dash-text-disabled">
          No active Denis session on this table.
        </p>
      )}

      <Link
        href="/dashboard/tables"
        className="mt-6 inline-flex text-sm font-medium text-[var(--qr-ember)] hover:text-[var(--qr-ember-hover)]"
      >
        Open full floor →
      </Link>
    </motion.aside>
  );
}

export function FloorViewLegend() {
  const items: Array<{ status: FloorTableRow["status"]; label: string }> = [
    { status: "free", label: "Available" },
    { status: "ordering", label: "Ordering" },
    { status: "waiting", label: "Waiting" },
    { status: "problem", label: "Problem" },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-dash-text-muted">
      {items.map(({ status, label }) => {
        const colors = floorViewStatusColor[status];
        return (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", colors.dot)} />
            {label}
          </span>
        );
      })}
    </div>
  );
}
