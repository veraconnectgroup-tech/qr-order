"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber } from "@/lib/format";
import {
  getKitchenOrderItems,
} from "@/lib/kitchen/menu-section";
import { groupOrderItemsForDisplay } from "@/lib/orders/group-order-items-for-display";
import { patchOrderStatus } from "@/lib/orders/patch-order-status";
import { useKitchenOrders } from "@/hooks/use-kitchen-orders";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { KitchenHeader } from "@/components/dashboard/kitchen-header";
import { RejectOrderDialog } from "@/components/dashboard/reject-order-dialog";
import { OrderItemProductLine } from "@/components/dashboard/order-item-product-line";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

function kitchenTimerStyles(minutes: number, light = false) {
  if (minutes >= 10) {
    return light ? "text-red-600" : "text-red-400";
  }
  if (minutes >= 5) {
    return light ? "text-amber-600" : "text-amber-400";
  }
  return light ? "text-emerald-600" : "text-emerald-400";
}

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
}: {
  order: OrderWithDetails;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onReject: () => void;
  busy: boolean;
  appearance?: "default" | "light";
}) {
  const light = appearance === "light";
  const [, tick] = useState(0);
  const tableName = order.tables?.name ?? "—";
  const since = order.created_at;
  const seconds = Math.floor(
    (Date.now() - new Date(since).getTime()) / 1000
  );
  const minutes = Math.floor(seconds / 60);
  const timerClass = kitchenTimerStyles(minutes, light);
  const isAccepted = order.status === "accepted";
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
        isAccepted ? "border-orange-500" : "border-blue-500"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "font-mono text-4xl font-black tracking-tight",
            light ? "text-zinc-900" : "text-zinc-50"
          )}
        >
          {formatOrderNumber(order.order_number)}
        </p>
        <div className="flex flex-col items-end gap-1">
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
            {formatKitchenTimer(seconds)}
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
    </motion.div>
  );
}

export function KitchenBoard() {
  const { locationId } = useDashboard();
  const { orders, loading, error, refetch, realtimeMode } =
    useKitchenOrders(locationId);
  const { play } = useSoundAlert();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
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
      (o) => o.status === "accepted" && !seenIdsRef.current.has(o.id)
    );

    if (newAccepted.length > 0) {
      play("kitchen-order");
      toast.info(
        newAccepted.length === 1
          ? "New order"
          : `${newAccepted.length} new orders`
      );
    }

    seenIdsRef.current = currentIds;
  }, [orders, loading, play]);

  const updateStatus = useCallback(
    async (
      orderId: string,
      status: "preparing" | "ready" | "rejected",
      rejectionReason?: string
    ) => {
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  busy={busyId === order.id}
                  onStartPreparing={() => updateStatus(order.id, "preparing")}
                  onMarkReady={() => updateStatus(order.id, "ready")}
                  onReject={() => setRejectTarget(order)}
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
          await updateStatus(rejectTarget.id, "rejected", reason);
          setRejectTarget(null);
        }}
      />
    </div>
  );
}
