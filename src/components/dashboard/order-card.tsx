"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import type { InPersonPaymentLocation } from "@/lib/constants";
import { TaxBreakdownLines } from "@/components/shared/tax-breakdown";
import { AskStationButton } from "@/components/dashboard/ask-station-button";
import { OrderItemProductLine } from "@/components/dashboard/order-item-product-line";
import { OrderDetailPanel } from "@/components/dashboard/order-detail-panel";
import { OrderPaymentMethodSelect } from "@/components/dashboard/order-payment-method-select";
import { KitchenPrintButton } from "@/components/dashboard/kitchen-print-button";
import { ReceiptPrintButton } from "@/components/dashboard/receipt-print-button";
import {
  DeliveryStatusBadge,
  TseStatusBadge,
} from "@/components/dashboard/delivery-status-badge";
import { cn } from "@/lib/utils";
import { orderHasKitchenItems } from "@/lib/kitchen/menu-section";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";
import { canStornoOrder } from "@/lib/orders/storno";
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
    border: "border-t-[var(--status-new)]",
    badge: "bg-[var(--status-new)] text-white",
    statuses: ["pending", "pending_approval"],
  },
  {
    id: "preparing",
    label: "Preparing",
    border: "border-t-[var(--status-preparing)]",
    badge: "bg-[var(--status-preparing)] text-white",
    statuses: ["preparing", "accepted"],
  },
  {
    id: "ready",
    label: "Ready",
    border: "border-t-[var(--status-ready)]",
    badge: "bg-[var(--status-ready)] text-white",
    statuses: ["ready"],
  },
  {
    id: "delivered",
    label: "Delivered",
    border: "border-t-[var(--status-delivered)]",
    badge: "bg-[var(--status-delivered)] text-zinc-200",
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
  if (minutes >= 20) return "text-red-400";
  if (minutes >= 10) return "text-amber-400";
  return "text-dash-text-muted";
}

function statusStripClass(columnId: OrderColumnDef["id"]) {
  return cn(
    "absolute inset-y-0 left-0 w-[3px] rounded-l-xl",
    columnId === "new" && "bg-[var(--status-new)]",
    columnId === "preparing" && "bg-[var(--status-preparing)]",
    columnId === "ready" && "bg-[var(--status-ready)]",
    columnId === "delivered" && "bg-[var(--status-delivered)]"
  );
}

function statusPillClass(columnId: OrderColumnDef["id"]) {
  return cn(
    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
    columnId === "new" && "bg-[var(--status-new-bg)] text-[var(--status-new-text)]",
    columnId === "preparing" && "bg-[var(--status-preparing-bg)] text-[var(--status-preparing-text)]",
    columnId === "ready" && "bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]",
    columnId === "delivered" && "bg-[var(--status-delivered-bg)] text-[var(--status-delivered-text)]"
  );
}

export function getOrderColumnId(
  status: string
): OrderColumnDef["id"] {
  if (status === "pending" || status === "pending_approval") return "new";
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

function OrderChannelBadges({
  order,
  light,
  fiscalTssEnabled = false,
}: {
  order: OrderWithDetails;
  light: boolean;
  fiscalTssEnabled?: boolean;
}) {
  const hasDeliveries = (order.order_channel_deliveries?.length ?? 0) > 0;
  if (!hasDeliveries && !fiscalTssEnabled) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasDeliveries && (
        <DeliveryStatusBadge
          deliveries={order.order_channel_deliveries}
          light={light}
        />
      )}
      <TseStatusBadge
        belegToken={order.beleg_token}
        fiscalTssEnabled={fiscalTssEnabled}
        light={light}
      />
    </div>
  );
}

export function OrderCard({
  order,
  currency,
  orgName,
  busy,
  onAccept,
  onReject,
  onApproveAccess,
  onStartPreparing,
  onMarkReady,
  onMarkDelivered,
  onRefund,
  staffRole,
  dragHandleProps,
  interactive = true,
  inPersonPaymentLocation = "bar",
  appearance = "default",
  fiscalTssEnabled = false,
  onPaymentMethodChange,
  onStorno,
}: {
  order: OrderWithDetails;
  currency: string;
  orgName?: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onApproveAccess?: () => void;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onMarkDelivered: () => void;
  onRefund?: () => void;
  staffRole?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  interactive?: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
  appearance?: "default" | "light";
  fiscalTssEnabled?: boolean;
  onPaymentMethodChange?: (method: string) => void;
  onStorno?: () => void;
}) {
  const light = appearance === "light";
  const columnId = getOrderColumnId(order.status);
  const tableName = order.tables?.name ?? "—";
  const zoneName = (order.tables as { zone?: { name: string } | null })?.zone
    ?.name;
  const paid = order.payment_status === "paid";
  const showStorno =
    Boolean(onStorno) &&
    canStornoOrder(order, staffRole ?? "staff") &&
    interactive;
  const groupedItems = groupOrderItemsForDisplay(order.order_items);

  if (order.status === "cancelled") {
    return (
      <motion.article
        layout={interactive}
        className={cn(
          "relative rounded-lg border p-3",
          light
            ? "border-zinc-200 bg-zinc-50"
            : "border-dash-border bg-dash-surface/60"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono font-semibold">
            {formatOrderNumber(order.order_number)}
          </span>
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
            Storniert
          </span>
          {order.rejection_reason && (
            <span className="text-xs text-dash-text-muted">
              {order.rejection_reason}
            </span>
          )}
        </div>
      </motion.article>
    );
  }

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
          "relative flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-all duration-150",
          light
            ? "border-zinc-200 bg-white"
            : "border-dash-border bg-dash-surface shadow-[var(--shadow-xs)]",
          deliveredAgeMs >= DELIVERED_BOARD_FADE_AGE_MS
            ? "opacity-40"
            : "opacity-60"
        )}
      >
        <div className={statusStripClass("delivered")} />
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm pl-1">
          <span
            className={cn(
              "shrink-0 font-mono font-semibold tabular-nums",
              light ? "text-zinc-900" : "text-dash-text"
            )}
          >
            {formatOrderNumber(order.order_number)}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
              light ? "bg-zinc-100 text-zinc-700" : "bg-dash-surface-raised text-dash-text-secondary"
            )}
          >
            {tableName}
          </span>
          <span className="ml-auto shrink-0 font-mono font-semibold tabular-nums text-dash-accent">
            {formatPrice(Number(order.total), currency)}
          </span>
          <OrderChannelBadges
            order={order}
            light={light}
            fiscalTssEnabled={fiscalTssEnabled}
          />
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-xs tabular-nums",
            light ? "text-zinc-500" : "text-dash-text-muted"
          )}
        >
          {formatOrderClockTime(timeIso)}
        </span>
        {orgName && paid && (
          <ReceiptPrintButton
            order={order}
            orgName={orgName}
            currency={currency}
            light={light}
          />
        )}
        {showStorno && (
          <button
            type="button"
            disabled={busy}
            onClick={onStorno}
            className="shrink-0 rounded-lg bg-red-600/15 px-2.5 py-1.5 text-xs font-semibold text-red-400 active:scale-[0.98] disabled:opacity-50"
          >
            Storno
          </button>
        )}
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
        "relative overflow-hidden rounded-xl border p-3 transition-all duration-150",
        light
          ? "border-zinc-200 bg-white shadow-sm hover:border-zinc-300 hover:shadow-md"
          : "border-dash-border bg-dash-surface shadow-[var(--shadow-card)] hover:border-dash-surface-raised hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-px"
      )}
    >
      <div className={statusStripClass(columnId)} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {dragHandleProps && (
            <button
              type="button"
              className="cursor-grab touch-none text-dash-text-disabled active:cursor-grabbing"
              aria-label="Drag order"
              {...dragHandleProps}
            >
              ⠿
            </button>
          )}
          <p className={cn("font-mono text-lg font-bold", light ? "text-zinc-900" : "text-dash-text")}>
            {formatOrderNumber(order.order_number)}
          </p>
          <span className={statusPillClass(columnId)}>{columnId}</span>
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
          {order.order_source === "pos" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                light
                  ? "bg-purple-100 text-purple-700"
                  : "bg-purple-500/15 text-purple-300"
              )}
            >
              POS
            </span>
          )}
          {order.transferred_from_table_name && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                light ? "text-zinc-500" : "text-dash-text-muted"
              )}
            >
              Transferred from {order.transferred_from_table_name}
            </span>
          )}
        </div>
        <OrderTimer createdAt={order.created_at} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", light ? "bg-zinc-100 text-zinc-700" : "bg-dash-surface-raised text-dash-text-secondary")}>
          {tableName}
        </span>
        {zoneName && <span className="text-xs text-dash-text-muted">{zoneName}</span>}
      </div>

      {!paid && order.status !== "rejected" && (
        <div className="mt-2">
          <OrderPaymentMethodSelect
            orderId={order.id}
            paymentMethod={(order as { payment_method?: string }).payment_method ?? "unset"}
            paymentStatus={order.payment_status}
            orderStatus={order.status}
            inPersonPaymentLocation={inPersonPaymentLocation}
            disabled={busy || !interactive}
            light={light}
            onOptimisticChange={onPaymentMethodChange}
          />
        </div>
      )}

      <ul
        className={cn(
          "mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs leading-snug",
          light ? "text-zinc-700" : "text-dash-text-secondary"
        )}
      >
        {groupedItems.map((item) => (
          <OrderItemProductLine
            key={item.key}
            item={item}
            modifiers={item.modifiers}
            notes={item.notes}
            allowMarkUnavailable
            nameClassName={light ? "text-zinc-700" : "text-dash-text-secondary"}
          />
        ))}
      </ul>

      <div className={cn("my-2 border-t", light ? "border-zinc-200" : "border-dash-border")} />

      {(order.order_items?.length ?? 0) > 0 && (
        <TaxBreakdownLines
          items={(order.order_items ?? []).map((item) => ({
            total: Number(item.total),
            tax_rate: Number(item.tax_rate ?? 19),
          }))}
          currency={currency}
          className={cn("mb-2", light ? "text-zinc-600" : "text-dash-text-muted")}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-base font-semibold text-dash-accent">
          {formatPrice(Number(order.total), currency)}
        </span>
        <OrderChannelBadges
          order={order}
          light={light}
          fiscalTssEnabled={fiscalTssEnabled}
        />
      </div>

      <div className="mt-2">
        <OrderDetailPanel
          order={order}
          currency={currency}
          staffRole={staffRole ?? "staff"}
          busy={busy}
          onRefund={onRefund}
          light={light}
          inPersonPaymentLocation={inPersonPaymentLocation}
          onPaymentMethodChange={onPaymentMethodChange}
        />
      </div>

      {orgName && (
        <div className="mt-3 flex flex-wrap gap-2">
          <KitchenPrintButton
            order={order}
            orgName={orgName}
            className="flex-1"
            reprint
            label="Reprint kitchen"
          />
          {paid && (
            <ReceiptPrintButton
              order={order}
              orgName={orgName}
              currency={currency}
              light={light}
              className="flex-1"
              reprint
              label="Reprint receipt"
            />
          )}
        </div>
      )}

      {columnId === "new" && order.status === "pending_approval" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy || !interactive}
            onClick={onReject}
            className="flex-1 rounded-lg border border-dash-border bg-transparent px-3 py-2.5 text-sm font-medium text-dash-text-muted transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 touch-manipulation"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy || !interactive || !onApproveAccess}
            onClick={onApproveAccess}
            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:bg-emerald-500 hover:shadow-[var(--shadow-sm)] disabled:opacity-50 touch-manipulation"
          >
            Approve order ►
          </button>
        </div>
      )}

      {columnId === "new" && order.status === "pending" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy || !interactive}
            onClick={onReject}
            className="flex-1 rounded-lg border border-dash-border bg-transparent px-3 py-2.5 text-sm font-medium text-dash-text-muted transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 touch-manipulation"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy || !interactive}
            onClick={onAccept}
            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:bg-emerald-500 hover:shadow-[var(--shadow-sm)] disabled:opacity-50 touch-manipulation"
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
          className="mt-3 w-full rounded-lg bg-[var(--status-preparing)] py-3 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:brightness-110 hover:shadow-[var(--shadow-sm)] disabled:opacity-50 touch-manipulation sm:py-2"
        >
          Start Preparing
        </button>
      )}

      {columnId === "preparing" && order.status === "preparing" && (
        <button
          type="button"
          disabled={busy || !interactive}
          onClick={onMarkReady}
          className="mt-3 w-full rounded-lg bg-[var(--status-ready)] py-3 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:brightness-110 hover:shadow-[var(--shadow-sm)] disabled:opacity-50 touch-manipulation sm:py-2"
        >
          Mark Ready
        </button>
      )}

      {columnId === "preparing" && interactive && (
        <AskStationButton
          orderId={order.id}
          station={orderHasKitchenItems(order) ? "kitchen" : "bar"}
          disabled={busy}
        />
      )}

      {columnId === "ready" && (
        <button
          type="button"
          disabled={busy || !interactive}
          onClick={onMarkDelivered}
          className="mt-3 w-full rounded-lg bg-dash-accent py-3 text-sm font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:bg-dash-accent-hover hover:shadow-[var(--shadow-sm)] disabled:opacity-50 touch-manipulation sm:py-2"
        >
          Mark Delivered
        </button>
      )}

      {showStorno && (
        <button
          type="button"
          disabled={busy || !interactive}
          onClick={onStorno}
          className="mt-2 w-full rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
        >
          Storno
        </button>
      )}
    </motion.article>
  );
}
