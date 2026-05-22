"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatOrderNumber } from "@/lib/format";
import { useKitchenOrders } from "@/hooks/use-kitchen-orders";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

function getElapsedSeconds(since: string) {
  return Math.floor((Date.now() - new Date(since).getTime()) / 1000);
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerStyles(minutes: number) {
  if (minutes >= 10) {
    return {
      text: "text-red-400",
      badge: "bg-red-500/10 text-red-400",
      card: "border-red-500/50 shadow-lg shadow-red-500/20",
    };
  }
  if (minutes >= 5) {
    return {
      text: "text-yellow-400",
      badge: "bg-yellow-500/10 text-yellow-400",
      card: "",
    };
  }
  return {
    text: "text-green-400",
    badge: "bg-green-500/10 text-green-400",
    card: "",
  };
}

function ItemCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 border-zinc-600 transition",
        checked && "border-orange-500 bg-orange-500"
      )}
    >
      {checked && <Check className="size-3 text-white" strokeWidth={3} />}
    </button>
  );
}

function KitchenCard({
  order,
  exiting,
  onMarkReady,
}: {
  order: OrderWithDetails;
  exiting: boolean;
  onMarkReady: () => void;
}) {
  const [, tick] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const tableName = order.tables?.name ?? "—";
  const zoneName = (order.tables as { zone?: { name: string } | null })?.zone
    ?.name;
  const since = order.preparing_at ?? order.accepted_at ?? order.created_at;
  const seconds = getElapsedSeconds(since);
  const minutes = Math.floor(seconds / 60);
  const styles = timerStyles(minutes);
  const items = order.order_items ?? [];
  const allChecked = items.length > 0 && checked.size >= items.length;

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function toggleItem(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={
        exiting
          ? { opacity: 0, scale: 0.92 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6",
        styles.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-3xl font-bold text-zinc-50">
          {formatOrderNumber(order.order_number)}
        </p>
        <span
          className={cn(
            "rounded-lg px-3 py-1 font-mono text-2xl font-bold tabular-nums",
            styles.badge,
            styles.text
          )}
        >
          {formatTimer(seconds)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-block rounded-lg bg-zinc-800 px-4 py-2 text-xl font-bold text-zinc-50">
          {tableName.toUpperCase()}
        </span>
        {zoneName && (
          <span className="text-base text-zinc-400">{zoneName}</span>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex items-start gap-3 text-lg text-zinc-200">
              <ItemCheckbox
                checked={checked.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
              <div>
                <p>
                  {item.quantity}× {item.product_name}
                </p>
                {item.order_item_modifiers?.map((m) => (
                  <p key={m.id} className="ml-6 text-base text-zinc-400">
                    + {m.modifier_name}
                  </p>
                ))}
                {item.notes && (
                  <p className="ml-6 text-base text-zinc-400">+ {item.notes}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={exiting}
        onClick={onMarkReady}
        className={cn(
          "mt-6 w-full rounded-xl bg-green-600 py-4 text-xl font-bold text-white transition hover:bg-green-700 disabled:opacity-50",
          allChecked && "animate-pulse ring-2 ring-green-400"
        )}
      >
        MARK READY
      </button>
    </motion.div>
  );
}

export function KitchenGrid() {
  const { locationId } = useDashboard();
  const { orders, loading } = useKitchenOrders(locationId);
  const { play } = useSoundAlert();
  const prevCountRef = useRef(0);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [localOrders, setLocalOrders] = useState<OrderWithDetails[]>([]);

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  useEffect(() => {
    if (orders.length > prevCountRef.current && !loading) {
      play("kitchen-order");
      toast.info("New order in kitchen");
    }
    prevCountRef.current = orders.length;
  }, [orders.length, loading, play]);

  async function markReady(orderId: string) {
    setExitingIds((prev) => new Set(prev).add(orderId));

    setTimeout(async () => {
      setLocalOrders((prev) => prev.filter((o) => o.id !== orderId));

      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: "ready", ready_at: new Date().toISOString() } as never)
        .eq("id", orderId);

      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });

      if (error) {
        toast.error(error.message);
        setLocalOrders(orders);
      }
    }, 280);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[360px] rounded-2xl bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (localOrders.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center p-4">
        <ChefHat className="size-16 text-zinc-700" />
        <p className="mt-4 text-xl text-zinc-500">All caught up!</p>
        <p className="mt-1 text-zinc-600">New orders will appear here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {localOrders.map((order) => (
          <KitchenCard
            key={order.id}
            order={order}
            exiting={exitingIds.has(order.id)}
            onMarkReady={() => markReady(order.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
