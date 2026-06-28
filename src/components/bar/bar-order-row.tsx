"use client";

import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";
import { getDrinksOrderItems } from "@/lib/kitchen/menu-section";
import {
  kdsActionLabel,
  nextKdsStatus,
  patchOrderStatus,
} from "@/lib/orders/patch-order-status";
import { barPrepLabel, type BarQueueEntry } from "@/lib/bar/bar-intelligence";
import { cn } from "@/lib/utils";
import { hapticClick, hapticSuccess } from "@/lib/haptics";

type Props = {
  entry: BarQueueEntry;
  currency: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onUpdated: () => void;
  onOptimisticStatus: (
    orderId: string,
    status: BarQueueEntry["order"]["status"]
  ) => void;
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
      return "Ready";
    case "pending_approval":
      return "Awaiting approval";
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
    case "delivered":
      return "Delivered";
    default:
      return "New";
  }
}

export function BarOrderRow({
  entry,
  currency,
  busy,
  onBusyChange,
  onUpdated,
  onOptimisticStatus,
}: Props) {
  const { order } = entry;
  const tableName = order.tables?.name ?? "—";
  const drinkItems = groupOrderItemsForDisplay(getDrinksOrderItems(order));
  const actionLabel = kdsActionLabel(order.status);
  const nextStatus = nextKdsStatus(order.status);
  const isDelivered = order.status === "delivered";

  async function advance() {
    if (busy || !nextStatus) return;
    onBusyChange(true);
    hapticClick();
    onOptimisticStatus(order.id, nextStatus);
    try {
      await patchOrderStatus(order.id, nextStatus);
      hapticSuccess();
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
      onUpdated();
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-dash-border-subtle bg-dash-surface p-4 shadow-sm",
        entry.foodWaitingBoost && "border-amber-500/40 ring-1 ring-amber-500/20",
        isDelivered && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-2xl font-bold tabular-nums text-dash-text">
              {formatOrderNumber(order.order_number)}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                statusBadgeClass(order.status)
              )}
            >
              {statusLabel(order.status)}
            </span>
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-200">
              {barPrepLabel(entry)}
            </span>
            {entry.foodWaitingBoost ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                Drink first
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-dash-text-secondary">
            Table {tableName}
          </p>
          <p className="text-xs text-dash-text-muted">
            {entry.priorityReasons.join(" · ")} ·{" "}
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-dash-text">
          {formatPrice(order.total, currency)}
        </p>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-dash-border-subtle pt-3">
        {drinkItems.map((item) => (
          <li
            key={item.key}
            className="flex items-start justify-between gap-2 text-sm text-dash-text"
          >
            <span className="min-w-0">
              <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
              {item.product_name}
              {item.modifiers.length > 0 && (
                <span className="block text-xs text-dash-text-muted">
                  {item.modifiers.map((m) => m.modifier_name).join(", ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {entry.cocktailCard ? (
        <div
          className={cn(
            "mt-3 rounded-lg border px-3 py-2.5",
            entry.cocktailCard.is86
              ? "border-red-500/30 bg-red-500/10"
              : "border-dash-border-subtle bg-dash-bg/40"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-dash-text-secondary">
              Cocktail card
            </p>
            {entry.cocktailCard.is86 ? (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-200">
                86 — {entry.cocktailCard.missingIngredients.join(", ")}
              </span>
            ) : null}
          </div>
          <ol className="mt-2 space-y-1 text-xs text-dash-text">
            {entry.cocktailCard.steps.map((step) => (
              <li key={step.label}>
                <span className="font-semibold">{step.label}:</span>{" "}
                {step.detail}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {actionLabel && nextStatus && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void advance()}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition-opacity hover:bg-orange-400 disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </article>
  );
}
