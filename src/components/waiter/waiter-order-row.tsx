"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { patchOrderStatus } from "@/lib/orders/patch-order-status";
import { cn } from "@/lib/utils";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import type { OrderItem, OrderItemModifier } from "@/types";

export type WaiterDetailOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  order_items: Array<
    OrderItem & { order_item_modifiers: OrderItemModifier[] }
  >;
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "ready":
      return "bg-orange-500/15 text-orange-300";
    case "pending_approval":
      return "bg-blue-500/15 text-blue-300";
    case "accepted":
    case "preparing":
      return "bg-yellow-500/15 text-yellow-300";
    case "delivered":
      return "bg-emerald-500/15 text-emerald-300";
    default:
      return "bg-dash-surface-raised text-dash-text-muted";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Spremno";
    case "pending_approval":
      return "Odobrenje";
    case "accepted":
      return "Prihvaćeno";
    case "preparing":
      return "Priprema";
    case "delivered":
      return "Dostavljeno";
    case "pending":
      return "Novo";
    default:
      return status;
  }
}

function itemsSummary(
  items: WaiterDetailOrder["order_items"]
): string {
  return items
    .slice(0, 2)
    .map((item) => `${item.quantity}× ${item.product_name}`)
    .join(", ");
}

type Props = {
  order: WaiterDetailOrder;
  currency: string;
  canUpdateStatus: boolean;
  onUpdated: () => void;
};

export function WaiterOrderRow({
  order,
  currency,
  canUpdateStatus,
  onUpdated,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const swipeAction =
    order.status === "ready"
      ? { label: "Dostavljeno", next: "delivered" as const }
      : order.status === "preparing" || order.status === "accepted"
        ? { label: "Spremno", next: "ready" as const }
        : null;

  async function applyStatus(
    status: "ready" | "delivered"
  ) {
    setBusy(true);
    try {
      await patchOrderStatus(order.id, status);
      hapticSuccess();
      toast.success(
        status === "delivered" ? "Narudžba dostavljena." : "Narudžba spremna."
      );
      onUpdated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Status nije ažuriran."
      );
    } finally {
      setBusy(false);
      setDragX(0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-dash-border-subtle bg-dash-surface">
      {swipeAction && canUpdateStatus && (
        <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-center bg-dash-accent text-sm font-semibold text-white">
          {swipeAction.label}
        </div>
      )}

      <div
        className="relative bg-dash-surface transition-transform"
        style={{ transform: `translateX(${dragX}px)` }}
        onTouchStart={(event) => {
          if (!swipeAction || !canUpdateStatus) return;
          setTouchStartX(event.touches[0]?.clientX ?? null);
        }}
        onTouchMove={(event) => {
          if (touchStartX === null || !swipeAction || !canUpdateStatus) return;
          const delta = (event.touches[0]?.clientX ?? touchStartX) - touchStartX;
          setDragX(Math.max(-112, Math.min(0, delta)));
        }}
        onTouchEnd={async () => {
          if (touchStartX === null || !swipeAction || !canUpdateStatus) return;
          setTouchStartX(null);
          if (dragX <= -72) {
            await applyStatus(swipeAction.next);
            return;
          }
          setDragX(0);
        }}
      >
        <button
          type="button"
          className="flex w-full items-start gap-3 p-4 text-left"
          onClick={() => {
            hapticLight();
            setExpanded((value) => !value);
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-dash-text">
                {formatOrderNumber(order.order_number)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  statusBadgeClass(order.status)
                )}
              >
                {statusLabel(order.status)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-dash-text-muted">
              {itemsSummary(order.order_items)}
              {order.order_items.length > 2 ? "…" : ""}
            </p>
            <p className="mt-1 text-[11px] text-dash-text-disabled">
              {formatDistanceToNow(new Date(order.created_at), {
                addSuffix: true,
                locale: de,
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="font-mono text-sm font-semibold text-dash-accent">
              {formatPrice(Number(order.total), currency)}
            </span>
            {expanded ? (
              <ChevronUp className="size-4 text-dash-text-muted" />
            ) : (
              <ChevronDown className="size-4 text-dash-text-muted" />
            )}
          </div>
        </button>

        {expanded && (
          <ul className="space-y-2 border-t border-dash-border-subtle px-4 py-3">
            {order.order_items.map((item) => (
              <li key={item.id} className="text-sm text-dash-text-secondary">
                <div className="flex justify-between gap-3">
                  <span>
                    {item.quantity}× {item.product_name}
                  </span>
                  <span className="font-mono text-dash-text-muted">
                    {formatPrice(Number(item.unit_price) * item.quantity, currency)}
                  </span>
                </div>
                {item.order_item_modifiers.length > 0 && (
                  <p className="mt-0.5 text-xs text-dash-text-disabled">
                    {item.order_item_modifiers
                      .map((modifier) => modifier.modifier_name)
                      .join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {swipeAction && canUpdateStatus && (
          <div className="border-t border-dash-border-subtle px-4 py-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyStatus(swipeAction.next)}
              className="min-h-11 w-full rounded-lg bg-dash-accent text-sm font-semibold text-white disabled:opacity-50"
            >
              {swipeAction.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
