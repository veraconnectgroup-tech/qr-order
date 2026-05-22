"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
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
  dragHandleProps,
  interactive = true,
}: {
  order: OrderWithDetails;
  currency: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onMarkDelivered: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  interactive?: boolean;
}) {
  const columnId = getOrderColumnId(order.status);
  const tableName = order.tables?.name ?? "—";
  const zoneName = (order.tables as { zone?: { name: string } | null })?.zone
    ?.name;
  const paid = order.payment_status === "paid";
  const paymentLabel = paymentMethodLabel(
    (order as { payment_method?: string }).payment_method ?? "online"
  );

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
        "rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700",
        columnId === "new" && "border-l-2 border-l-orange-500",
        columnId === "delivered" && "opacity-60"
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
          <p className="font-mono text-lg font-bold text-zinc-50">
            {formatOrderNumber(order.order_number)}
          </p>
        </div>
        <OrderTimer createdAt={order.created_at} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-200">
          {tableName}
        </span>
        {zoneName && <span className="text-xs text-zinc-500">{zoneName}</span>}
      </div>

      <ul className="mt-3 space-y-1 text-sm text-zinc-300">
        {order.order_items?.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.product_name}
            {item.order_item_modifiers?.map((m) => (
              <span key={m.id} className="ml-4 block text-xs text-zinc-500">
                + {m.modifier_name}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-zinc-800" />

      <div className="flex items-center justify-between">
        <span className="font-mono text-base font-semibold text-orange-500">
          {formatPrice(Number(order.total), currency)}
        </span>
        {paid ? (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
            Paid ✓
          </span>
        ) : (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {paymentLabel}
          </span>
        )}
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
