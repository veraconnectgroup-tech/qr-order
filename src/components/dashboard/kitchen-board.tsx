"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber } from "@/lib/format";
import { useKitchenOrders } from "@/hooks/use-kitchen-orders";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { KitchenHeader } from "@/components/dashboard/kitchen-header";
import { RejectOrderDialog } from "@/components/dashboard/reject-order-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

function formatTimeAgo(iso: string) {
  const minutes = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 60_000
  );
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

function elapsedStyles(minutes: number) {
  if (minutes >= 10) {
    return { text: "text-red-400", pulse: true };
  }
  if (minutes >= 5) {
    return { text: "text-yellow-400", pulse: false };
  }
  return { text: "text-green-400", pulse: false };
}

async function patchOrderStatus(
  orderId: string,
  status: "preparing" | "ready" | "rejected",
  rejectionReason?: string
) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, rejectionReason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? "Update failed");
  }
}

export function KitchenCard({
  order,
  onStartPreparing,
  onMarkReady,
  onReject,
  busy,
}: {
  order: OrderWithDetails;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const [, tick] = useState(0);
  const tableName = order.tables?.name ?? "—";
  const since = order.created_at;
  const minutes = Math.floor(
    (Date.now() - new Date(since).getTime()) / 60_000
  );
  const styles = elapsedStyles(minutes);
  const isAccepted = order.status === "accepted";
  const items = order.order_items ?? [];

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl border-2 bg-zinc-900 p-4",
        isAccepted ? "border-orange-500" : "border-blue-500",
        styles.pulse && "animate-pulse"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xl font-bold text-zinc-100">
          {formatOrderNumber(order.order_number)}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-400">
            {tableName}
          </span>
          <span className={cn("text-sm", styles.text)}>
            {formatTimeAgo(since)}
          </span>
        </div>
      </div>

      <div className="my-3 border-t border-zinc-800" />

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <p className="text-base text-zinc-200">
              <span className="font-bold text-orange-500">{item.quantity}×</span>{" "}
              {item.product_name}
            </p>
            {item.order_item_modifiers?.map((m) => (
              <p key={m.id} className="pl-6 text-sm text-zinc-500">
                → {m.modifier_name}
              </p>
            ))}
            {item.notes && (
              <p className="pl-6 text-sm text-zinc-500">→ {item.notes}</p>
            )}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-3 border-l-2 border-amber-500 pl-3 text-sm italic text-amber-400">
          {order.notes}
        </p>
      )}

      <div className="my-3 border-t border-zinc-800" />

      <div className="flex flex-wrap items-center gap-2">
        {isAccepted ? (
          <button
            type="button"
            disabled={busy}
            onClick={onStartPreparing}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            Start Preparing
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onMarkReady}
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
          >
            Ready
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="text-xs text-red-400 transition hover:text-red-300 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </motion.div>
  );
}

export function KitchenBoard() {
  const { locationId } = useDashboard();
  const { orders, loading, error, refetch } = useKitchenOrders(locationId);
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
          ? "New order in kitchen"
          : `${newAccepted.length} new orders in kitchen`
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
        await patchOrderStatus(orderId, status, rejectionReason);
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
      <KitchenHeader orders={orders} />

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
          <p className="mt-1 text-zinc-600">New orders will appear here</p>
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
