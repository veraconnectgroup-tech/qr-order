"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber } from "@/lib/format";
import {
  buildKdsFulfillmentLabel,
  orderModeFromLegacy,
} from "@/lib/denis/commerce/delivery-mode";
import { getKitchenOrderItems } from "@/lib/kitchen/menu-section";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";
import { patchOrderStatus } from "@/lib/orders/patch-order-status";
import { useKitchenOrders } from "@/hooks/use-kitchen-orders";
import {
  coursePacingHoldMinutesRemaining,
  extractKitchenAllergyBanner,
  isOrderHeldForCoursePacing,
  kdsUrgencyBorderClass,
  kdsUrgencyForOrder,
  kdsUrgencyTimerClass,
} from "@/lib/kitchen/kds-intelligence";
import { isProvisionalKdsOrder } from "@/lib/pos/provisional-display";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { KitchenHeader } from "@/components/dashboard/kitchen-header";
import { RejectOrderDialog } from "@/components/dashboard/reject-order-dialog";
import { OrderItemProductLine } from "@/components/dashboard/order-item-product-line";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";
import type { ProvisionalKdsOrder } from "@/lib/pos/provisional-display";

function formatKitchenTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function patchKitchenOrderStatus(
  orderId: string,
  status: "preparing" | "ready" | "rejected",
  rejectionReason?: string
) {
  await patchOrderStatus(orderId, status, rejectionReason);
}

export function KitchenCard({
  order,
  onStartPreparing,
  onMarkReady,
  onReject,
  busy,
  appearance = "default",
  sessionOrders = [],
}: {
  order: OrderWithDetails | ProvisionalKdsOrder;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onReject: () => void;
  busy: boolean;
  appearance?: "default" | "light";
  sessionOrders?: OrderWithDetails[];
}) {
  const light = appearance === "light";
  const isProvisional = isProvisionalKdsOrder(order);
  const [, tick] = useState(0);
  const tableName = order.tables?.name ?? "—";
  const fulfillmentLabel = !isProvisional
    ? buildKdsFulfillmentLabel(
        orderModeFromLegacy(Boolean((order as { is_takeaway?: boolean }).is_takeaway))
      )
    : null;
  const urgency = isProvisional ? "green" : kdsUrgencyForOrder(order as OrderWithDetails);
  const elapsedSeconds = isProvisional
    ? 0
    : Math.floor(
        (Date.now() - new Date(
          (order as OrderWithDetails).preparing_at ??
            (order as OrderWithDetails).accepted_at ??
            order.created_at
        ).getTime()) / 1000
      );
  const timerClass = kdsUrgencyTimerClass(urgency, light);
  const allergyBanner = isProvisional
    ? null
    : extractKitchenAllergyBanner(order as OrderWithDetails);
  const courseHeld = isProvisional
    ? false
    : isOrderHeldForCoursePacing(order as OrderWithDetails, sessionOrders);
  const courseHoldMinutes = courseHeld
    ? coursePacingHoldMinutesRemaining(order as OrderWithDetails, sessionOrders)
    : null;
  const isAccepted = !isProvisional && order.status === "accepted";
  const items = groupOrderItemsForDisplay(getKitchenOrderItems(order));

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      layout
      layoutId={`kitchen-card-${order.id}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        "rounded-xl border-2 p-4 transition-colors duration-300",
        light ? "bg-white" : "bg-zinc-900",
        isProvisional
          ? order.provisionalConflictReason
            ? "border-red-500"
            : "border-orange-500"
          : courseHeld
            ? "border-violet-500/80"
            : kdsUrgencyBorderClass(urgency)
      )}
    >
      {allergyBanner && (
        <div
          className="mb-3 rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-center text-sm font-bold uppercase tracking-wide text-white"
        >
          {allergyBanner.headline}
          {allergyBanner.detail ? ` — ${allergyBanner.detail}` : ""}
        </div>
      )}

      {courseHeld && courseHoldMinutes != null && (
        <div className="mb-3 rounded-lg border border-violet-500/50 bg-violet-500/10 px-3 py-2 text-center text-sm font-semibold text-violet-300">
          Course pacing — glavno jelo za ~{courseHoldMinutes} min
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {isProvisional ? (
          <div>
            <span
              className={cn(
                "inline-block rounded-full px-3 py-1 text-xs font-bold uppercase",
                light ? "bg-orange-100 text-orange-700" : "bg-orange-500/20 text-orange-300"
              )}
            >
              SYNC…
            </span>
            <p
              className={cn(
                "mt-1 font-mono text-2xl font-black",
                light ? "text-zinc-500" : "text-zinc-500"
              )}
            >
              …
            </p>
          </div>
        ) : (
          <p
            className={cn(
              "font-mono text-4xl font-black tracking-tight",
              light ? "text-zinc-900" : "text-zinc-50"
            )}
          >
            {formatOrderNumber(order.order_number)}
          </p>
        )}
        <div className="flex flex-col items-end gap-1">
          {fulfillmentLabel ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                light ? "bg-amber-100 text-amber-800" : "bg-amber-500/20 text-amber-300"
              )}
            >
              {fulfillmentLabel}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              light ? "bg-zinc-100 text-zinc-600" : "bg-zinc-800 text-zinc-400"
            )}
          >
            {tableName}
          </span>
          <span
            className={cn(
              "font-mono text-lg font-bold tabular-nums",
              timerClass
            )}
          >
            {formatKitchenTimer(elapsedSeconds)}
          </span>
        </div>
      </div>

      <div className={cn("my-3 border-t", light ? "border-zinc-200" : "border-zinc-800")} />

      <ul className="space-y-2">
        {items.map((item) => (
          <OrderItemProductLine
            key={item.key}
            item={item}
            modifiers={item.modifiers}
            notes={item.notes}
            nameClassName={light ? "text-zinc-800" : "text-zinc-200"}
          />
        ))}
      </ul>

      {order.notes && (
        <p className={cn("mt-3 border-l-2 border-amber-500 pl-3 text-sm italic", light ? "text-amber-700" : "text-amber-400")}>
          {order.notes}
        </p>
      )}

      <div className={cn("my-3 border-t", light ? "border-zinc-200" : "border-zinc-800")} />

      {isProvisional ? (
        <p
          className={cn(
            "text-sm font-medium",
            light ? "text-orange-700" : "text-orange-300"
          )}
        >
          Warte auf Cloud-Bestätigung…
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {isAccepted ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStartPreparing}
              className="min-h-11 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50 touch-manipulation"
            >
              Start Preparing
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onMarkReady}
              className="min-h-11 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50 touch-manipulation"
            >
              Ready
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="min-h-11 px-3 text-sm text-red-400 transition hover:text-red-300 disabled:opacity-50 touch-manipulation"
          >
            Reject
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function KitchenBoard() {
  const { locationId } = useDashboard();
  const {
    orders,
    kitchenOrders,
    prepBatches,
    loading,
    error,
    refetch,
    realtimeMode,
    provisionalSyncFailedCount,
  } = useKitchenOrders(locationId);
  const { play } = useSoundAlert();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seenProvisionalRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const criticalIdsRef = useRef<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrderWithDetails | null>(
    null
  );

  useEffect(() => {
    if (loading) return;

    const currentIds = new Set(orders.map((o) => o.id));

    if (!initializedRef.current) {
      seenIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }

    const newAccepted = orders.filter(
      (o) =>
        !isProvisionalKdsOrder(o) &&
        o.status === "accepted" &&
        !seenIdsRef.current.has(o.id)
    );
    const newProvisionals = orders.filter(
      (o): o is ProvisionalKdsOrder =>
        isProvisionalKdsOrder(o) &&
        !seenProvisionalRef.current.has(o.clientOrderId)
    );

    if (newAccepted.length > 0 || newProvisionals.length > 0) {
      play("kitchen-order");
      const count = newAccepted.length + newProvisionals.length;
      toast.info(count === 1 ? "New order" : `${count} new orders`);
    }

    seenIdsRef.current = currentIds;
    seenProvisionalRef.current = new Set(
      orders
        .filter(isProvisionalKdsOrder)
        .map((o) => o.clientOrderId)
    );
  }, [orders, loading, play]);

  useEffect(() => {
    if (loading) return;
    for (const order of kitchenOrders) {
      const urgency = kdsUrgencyForOrder(order);
      if (urgency === "red" && !criticalIdsRef.current.has(order.id)) {
        criticalIdsRef.current.add(order.id);
        play("kitchen-critical");
      }
    }
  }, [kitchenOrders, loading, play]);

  const updateStatus = useCallback(
    async (
      order: OrderWithDetails | ProvisionalKdsOrder,
      status: "preparing" | "ready" | "rejected",
      rejectionReason?: string
    ) => {
      if (isProvisionalKdsOrder(order)) return;
      const orderId = order.id;
      setBusyId(orderId);
      try {
        await patchKitchenOrderStatus(orderId, status, rejectionReason);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
        await refetch();
      } finally {
        setBusyId(null);
      }
    },
    [refetch]
  );

  return (
    <div className="flex min-h-screen flex-col">
      <KitchenHeader orders={orders} realtimeMode={realtimeMode} />

      {provisionalSyncFailedCount > 0 && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-300">
          Sync failed — provisional ticket timed out ({provisionalSyncFailedCount})
        </div>
      )}

      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-400">
          {error}{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-zinc-800" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <ChefHat className="size-16 text-zinc-700" />
          <p className="mt-4 text-xl text-zinc-500">All caught up!</p>
          <p className="mt-1 text-zinc-600">
            Food & dessert orders will appear here
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {prepBatches.length > 0 && (
            <div className="mb-4 rounded-xl border border-zinc-700 bg-zinc-900/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Denis prep batch
              </p>
              <ul className="mt-2 space-y-1">
                {prepBatches.map((batch) => (
                  <li
                    key={batch.productName}
                    className="text-sm font-medium text-orange-300"
                  >
                    {batch.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  sessionOrders={kitchenOrders}
                  busy={busyId === order.id}
                  onStartPreparing={() => updateStatus(order, "preparing")}
                  onMarkReady={() => updateStatus(order, "ready")}
                  onReject={() => {
                    if (!isProvisionalKdsOrder(order)) setRejectTarget(order);
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <RejectOrderDialog
        open={!!rejectTarget}
        orderNumber={rejectTarget?.order_number ?? 0}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          await updateStatus(rejectTarget, "rejected", reason);
          setRejectTarget(null);
        }}
      />
    </div>
  );
}
