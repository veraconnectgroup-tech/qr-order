"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, CreditCard } from "lucide-react";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import type { InPersonPaymentLocation } from "@/lib/constants";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { TaxBreakdownLines } from "@/components/shared/tax-breakdown";
import { OrderItemProductLine } from "@/components/dashboard/order-item-product-line";
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

export type OrderColumnDef = {
  id: "new" | "preparing" | "ready" | "delivered";
  label: string;
  border: string;
  badge: string;
  statuses: string[];
};

export const ORDER_COLUMNS: OrderColumnDef[] = [
  {
    id: "new",
    label: "New",
    border: "border-t-orange-500",
    badge: "bg-orange-500 text-white",
    statuses: ["pending"],
  },
  {
    id: "preparing",
    label: "Preparing",
    border: "border-t-yellow-500",
    badge: "bg-yellow-500 text-zinc-950",
    statuses: ["preparing", "accepted"],
  },
  {
    id: "ready",
    label: "Ready",
    border: "border-t-green-500",
    badge: "bg-green-500 text-white",
    statuses: ["ready"],
  },
  {
    id: "delivered",
    label: "Delivered",
    border: "border-t-zinc-600",
    badge: "bg-zinc-700 text-zinc-300",
    statuses: ["delivered"],
  },
];

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timerColor(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 10) return "text-red-400";
  if (minutes >= 5) return "text-yellow-400";
  return "text-zinc-500";
}

export function getOrderColumnId(
  status: string
): OrderColumnDef["id"] {
  if (status === "pending") return "new";
  if (status === "preparing" || status === "accepted") return "preparing";
  if (status === "ready") return "ready";
  return "delivered";
}

export const DELIVERED_BOARD_MAX_AGE_MS = 60 * 60 * 1000;
export const DELIVERED_BOARD_FADE_AGE_MS = 30 * 60 * 1000;
export const DELIVERED_BOARD_MAX_VISIBLE = 10;

export function getDeliveredTimestamp(order: OrderWithDetails): number {
  return new Date(
    order.delivered_at ?? order.updated_at ?? order.created_at
  ).getTime();
}

export function getDeliveredAgeMs(order: OrderWithDetails): number {
  return Date.now() - getDeliveredTimestamp(order);
}

export function isDeliveredVisibleOnBoard(order: OrderWithDetails): boolean {
  if (order.status !== "delivered") return true;
  return getDeliveredAgeMs(order) < DELIVERED_BOARD_MAX_AGE_MS;
}

function formatOrderClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function OrderTimer({ createdAt }: { createdAt: string }) {
  const [seconds, setSeconds] = useState(() =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(
        Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
      );
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return (
    <span
      className={cn(
        "flex items-center gap-1 font-mono text-xs tabular-nums",
        timerColor(seconds)
      )}
    >
      <Clock className="size-3" />
      {formatTimer(seconds)}
    </span>
  );
}

export function OrderCard({
  order,
  currency,
  busy,
  onAccept,
  onReject,
  onStartPreparing,
  onMarkReady,
  onMarkDelivered,
  onRefund,
  staffRole,
  dragHandleProps,
  interactive = true,
  inPersonPaymentLocation = "bar",
  appearance = "default",
}: {
  order: OrderWithDetails;
  currency: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onMarkDelivered: () => void;
  onRefund?: () => void;
  staffRole?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  interactive?: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
  appearance?: "default" | "light";
}) {
  const light = appearance === "light";
  const columnId = getOrderColumnId(order.status);
  const tableName = order.tables?.name ?? "—";
  const zoneName = (order.tables as { zone?: { name: string } | null })?.zone
    ?.name;
  const paid = order.payment_status === "paid";
  const paymentRequested =
    !paid &&
    order.payment_requested_at != null &&
    order.payment_method !== "unset";
  const paymentLabel = paymentMethodLabel(
    (order as { payment_method?: string }).payment_method ?? "online",
    inPersonPaymentLocation
  );

  if (columnId === "delivered") {
    const deliveredAgeMs = getDeliveredAgeMs(order);
    const timeIso =
      order.delivered_at ?? order.updated_at ?? order.created_at;

    return (
      <motion.article
        layout={interactive}
        layoutId={interactive ? order.id : undefined}
        initial={interactive ? { opacity: 0, y: -8 } : false}
        animate={interactive ? { opacity: 1, y: 0 } : undefined}
        exit={interactive ? { opacity: 0, scale: 0.98 } : undefined}
        transition={
          interactive
            ? { type: "spring", stiffness: 400, damping: 30 }
            : undefined
        }
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border p-2.5 transition",
          light
            ? "border-zinc-200 bg-white"
            : "border-zinc-800 bg-zinc-900",
          deliveredAgeMs >= DELIVERED_BOARD_FADE_AGE_MS
            ? "opacity-40"
            : "opacity-60"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span
            className={cn(
              "shrink-0 font-mono font-semibold tabular-nums",
              light ? "text-zinc-900" : "text-zinc-50"
            )}
          >
            {formatOrderNumber(order.order_number)}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
              light ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300"
            )}
          >
            {tableName}
          </span>
          <span className="ml-auto shrink-0 font-mono font-semibold tabular-nums text-orange-500">
            {formatPrice(Number(order.total), currency)}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-xs tabular-nums",
            light ? "text-zinc-500" : "text-zinc-500"
          )}
        >
          {formatOrderClockTime(timeIso)}
        </span>
      </motion.article>
    );
  }

  return (
    <motion.article
      layout={interactive}
      layoutId={interactive ? order.id : undefined}
      initial={interactive ? { opacity: 0, y: -16 } : false}
      animate={interactive ? { opacity: 1, y: 0 } : undefined}
      exit={interactive ? { opacity: 0, scale: 0.96 } : undefined}
      transition={
        interactive
          ? { type: "spring", stiffness: 400, damping: 30 }
          : undefined
      }
      className={cn(
        "rounded-xl border p-4 transition",
        light
          ? "border-zinc-200 bg-white hover:border-zinc-300"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
        columnId === "new" && "border-l-2 border-l-orange-500",
        paymentRequested && "ring-2 ring-amber-500/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <button
              type="button"
              className="cursor-grab touch-none text-zinc-600 active:cursor-grabbing"
              aria-label="Drag order"
              {...dragHandleProps}
            >
              ⠿
            </button>
          )}
          <p className={cn("font-mono text-lg font-bold", light ? "text-zinc-900" : "text-zinc-50")}>
            {formatOrderNumber(order.order_number)}
          </p>
          {order.order_source === "staff" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                light
                  ? "bg-blue-100 text-blue-700"
                  : "bg-blue-500/15 text-blue-300"
              )}
            >
              Staff
            </span>
          )}
        </div>
        <OrderTimer createdAt={order.created_at} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", light ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-200")}>
          {tableName}
        </span>
        {zoneName && <span className="text-xs text-zinc-500">{zoneName}</span>}
      </div>

      {paymentRequested && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300">
          <CreditCard className="size-3.5 shrink-0" />
          Payment requested · {paymentLabel}
        </div>
      )}

      <ul className={cn("mt-3 space-y-1 text-sm", light ? "text-zinc-700" : "text-zinc-300")}>
        {order.order_items?.map((item) => (
          <OrderItemProductLine
            key={item.id}
            item={item}
            modifiers={item.order_item_modifiers}
            allowMarkUnavailable
            nameClassName={light ? "text-zinc-700" : "text-zinc-300"}
          />
        ))}
      </ul>

      <div className={cn("my-3 border-t", light ? "border-zinc-200" : "border-zinc-800")} />

      {(order.order_items?.length ?? 0) > 0 && (
        <TaxBreakdownLines
          items={(order.order_items ?? []).map((item) => ({
            total: Number(item.total),
            tax_rate: Number(item.tax_rate ?? 19),
          }))}
          currency={currency}
          className={cn("mb-2", light ? "text-zinc-600" : "text-zinc-500")}
        />
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-base font-semibold text-orange-500">
          {formatPrice(Number(order.total), currency)}
        </span>
      </div>

      <div className="mt-2">
        <OrderDetailPanel
          order={order}
          currency={currency}
          staffRole={staffRole ?? "staff"}
          busy={busy}
          onRefund={onRefund}
          light={light}
        />
      </div>

      {columnId === "new" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy || !interactive}
            onClick={onReject}
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-3 text-sm text-zinc-400 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50 touch-manipulation sm:py-2"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy || !interactive}
            onClick={onAccept}
            className="flex-1 rounded-lg bg-orange-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50 touch-manipulation sm:py-2"
          >
            Accept ►
          </button>
        </div>
      )}

      {columnId === "preparing" && order.status === "accepted" && (
        <button
          type="button"
          disabled={busy || !interactive}
          onClick={onStartPreparing}
          className="mt-3 w-full rounded-lg bg-yellow-600 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-yellow-500 disabled:opacity-50 touch-manipulation sm:py-2"
        >
          Start Preparing
        </button>
      )}

      {columnId === "preparing" && order.status === "preparing" && (
        <button
          type="button"
          disabled={busy || !interactive}
          onClick={onMarkReady}
          className="mt-3 w-full rounded-lg bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 touch-manipulation sm:py-2"
        >
          Mark Ready
        </button>
      )}

      {columnId === "ready" && (
        <button
          type="button"
          disabled={busy || !interactive}
          onClick={onMarkDelivered}
          className="mt-3 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 touch-manipulation sm:py-2"
        >
          Mark Delivered
        </button>
      )}
    </motion.article>
  );
}
