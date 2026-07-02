"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import {
  patchOrderStatus,
  patchStationStatusClient,
} from "@/lib/orders/patch-order-status";
import type { OrderStationState } from "@/lib/orders/fetch-order-station-states";
import {
  waiterNeedsLegacyDeliver,
  waiterStationActions,
} from "@/lib/orders/station-display";
import type { StationKind } from "@/lib/orders/station-states";
import { cn } from "@/lib/utils";
import { hapticClick, hapticLight, hapticSuccess } from "@/lib/haptics";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";
import { dateFnsLocaleForMenu } from "@/lib/i18n/date-fns-locale";
import type { WaiterDetailOrderRow } from "@/lib/dashboard/waiter-table-data";

export type WaiterDetailOrder = WaiterDetailOrderRow & {
  station_states?: OrderStationState[];
};

const SWIPE_ACTION_WIDTH = 112;
const SWIPE_THRESHOLD = 72;

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

function itemsSummary(items: WaiterDetailOrder["order_items"]) {
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
  onOptimisticStatus?: (orderId: string, status: string) => void;
  onOptimisticStationStatus?: (
    orderId: string,
    station: StationKind,
    status: string,
    globalStatus?: string
  ) => void;
};

export function WaiterOrderRow({
  order,
  currency,
  canUpdateStatus,
  onUpdated,
  onOptimisticStatus,
  onOptimisticStationStatus,
}: Props) {
  const { t, menuLocale } = useWaiterI18n();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragX, setDragX] = useState(0);
  const touchStartRef = { x: 0, y: 0 };
  const draggingRef = { horizontal: false };

  const stationActions = waiterStationActions(
    order.order_items,
    order.station_states
  );
  const legacyDeliver = waiterNeedsLegacyDeliver(
    order.status,
    order.station_states
  );

  const statusLabel = (status: string) => {
    switch (status) {
      case "ready":
        return t("order.status.ready");
      case "pending_approval":
        return t("order.status.pendingApproval");
      case "accepted":
        return t("order.status.accepted");
      case "preparing":
        return t("order.status.preparing");
      case "delivered":
        return t("order.status.delivered");
      default:
        return t("order.status.new");
    }
  };

  const canSwipeDeliver =
    legacyDeliver ||
    stationActions.some((action) => action.toStatus === "served");

  async function applyStationAction(
    station: StationKind,
    toStatus: "picked_up" | "served"
  ) {
    if (busy) return;
    setBusy(true);
    hapticClick();
    onOptimisticStationStatus?.(order.id, station, toStatus);
    setDragX(0);

    try {
      const result = await patchStationStatusClient(order.id, station, toStatus);
      onOptimisticStationStatus?.(
        order.id,
        station,
        result.stationStatus,
        result.globalStatus
      );
      hapticSuccess();
      toast.success(
        toStatus === "served" ? t("order.delivered") : t("action.pickedUp"),
        { duration: 3000 }
      );
      onUpdated();
    } catch (error) {
      onUpdated();
      toast.error(
        error instanceof Error ? error.message : t("order.updateFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyLegacyDeliver() {
    if (busy) return;
    setBusy(true);
    hapticClick();
    onOptimisticStatus?.(order.id, "delivered");
    setDragX(0);

    try {
      await patchOrderStatus(order.id, "delivered");
      hapticSuccess();
      toast.success(t("order.delivered"), { duration: 3000 });
      onUpdated();
    } catch (error) {
      onUpdated();
      toast.error(
        error instanceof Error ? error.message : t("order.updateFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  function handleExpand() {
    hapticLight();
    setExpanded((value) => !value);
    setDragX(0);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-dash-border-subtle bg-dash-surface touch-manipulation">
      {canSwipeDeliver && canUpdateStatus && (
        <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-center bg-dash-accent text-sm font-semibold text-white">
          {t("action.served")}
        </div>
      )}
      <div className="absolute inset-y-0 left-0 flex w-28 items-center justify-center bg-dash-surface-raised text-sm font-semibold text-dash-text-muted">
        <ChevronDown className="size-5" />
      </div>

      <div
        className="relative bg-dash-surface transition-transform duration-150"
        style={{ transform: `translateX(${dragX}px)` }}
        onTouchStart={(event) => {
          touchStartRef.x = event.touches[0]?.clientX ?? 0;
          touchStartRef.y = event.touches[0]?.clientY ?? 0;
          draggingRef.horizontal = false;
        }}
        onTouchMove={(event) => {
          const x = event.touches[0]?.clientX ?? touchStartRef.x;
          const y = event.touches[0]?.clientY ?? touchStartRef.y;
          const deltaX = x - touchStartRef.x;
          const deltaY = y - touchStartRef.y;

          if (!draggingRef.horizontal && Math.abs(deltaX) > 10) {
            draggingRef.horizontal = Math.abs(deltaX) > Math.abs(deltaY);
          }
          if (!draggingRef.horizontal) return;

          if (deltaX < 0 && canSwipeDeliver && canUpdateStatus) {
            setDragX(Math.max(-SWIPE_ACTION_WIDTH, deltaX));
            return;
          }
          if (deltaX > 0) {
            setDragX(Math.min(SWIPE_ACTION_WIDTH, deltaX));
          }
        }}
        onTouchEnd={async () => {
          if (dragX <= -SWIPE_THRESHOLD && canSwipeDeliver && canUpdateStatus) {
            const serveAction = stationActions.find(
              (action) => action.toStatus === "served"
            );
            if (serveAction) {
              await applyStationAction(serveAction.station, "served");
            } else if (legacyDeliver) {
              await applyLegacyDeliver();
            }
            return;
          }
          if (dragX >= SWIPE_THRESHOLD) {
            if (!expanded) {
              hapticLight();
              setExpanded(true);
            }
            setDragX(0);
            return;
          }
          if (Math.abs(dragX) < 12) {
            handleExpand();
            return;
          }
          setDragX(0);
        }}
      >
        <button
          type="button"
          className="flex min-h-12 w-full items-start gap-3 p-4 text-left active:bg-dash-surface-raised"
          onClick={handleExpand}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-bold text-dash-text">
                {formatOrderNumber(order.order_number)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
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
            <p className="mt-1 text-xs text-dash-text-disabled">
              {formatDistanceToNow(new Date(order.created_at), {
                addSuffix: true,
                locale: dateFnsLocaleForMenu(menuLocale),
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="font-mono text-lg font-semibold text-dash-accent">
              {formatPrice(Number(order.total), currency)}
            </span>
            {expanded ? (
              <ChevronUp className="size-5 text-dash-text-muted" />
            ) : (
              <ChevronDown className="size-5 text-dash-text-muted" />
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
                  <span className="font-mono text-base text-dash-text-muted">
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

        {canUpdateStatus &&
          (stationActions.length > 0 || legacyDeliver) && (
          <div className="flex flex-col gap-2 border-t border-dash-border-subtle px-4 py-3">
            {stationActions.map((action) => (
              <button
                key={`${action.station}-${action.toStatus}`}
                type="button"
                disabled={busy}
                onClick={() =>
                  void applyStationAction(action.station, action.toStatus)
                }
                className="min-h-12 w-full rounded-lg bg-dash-accent text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {action.station === "bar" ? "Bar · " : "Kitchen · "}
                {t(action.labelKey)}
              </button>
            ))}
            {legacyDeliver && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyLegacyDeliver()}
                className="min-h-12 w-full rounded-lg bg-dash-accent text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {t("action.deliver")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
