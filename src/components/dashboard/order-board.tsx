"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { RejectOrderDialog } from "@/components/dashboard/reject-order-dialog";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { cn } from "@/lib/utils";
import type { OrderStatus, OrderWithDetails } from "@/types";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name))";

type ColumnDef = {
  id: "new" | "preparing" | "ready" | "delivered";
  label: string;
  border: string;
  badge: string;
  statuses: string[];
};

const COLUMNS: ColumnDef[] = [
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

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

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

function getColumnId(status: string): ColumnDef["id"] {
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

function OrderCard({
  order,
  currency,
  busy,
  onAccept,
  onReject,
  onStartPreparing,
  onMarkReady,
  onMarkDelivered,
  dragHandleProps,
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
}) {
  const columnId = getColumnId(order.status);
  const tableName = order.tables?.name ?? "—";
  const zoneName = (order.tables as { zone?: { name: string } | null })?.zone
    ?.name;
  const paid = order.payment_status === "paid";

  return (
    <motion.article
      layout
      layoutId={order.id}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
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
        {paid && (
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
            Paid ✓
          </span>
        )}
      </div>

      {columnId === "new" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            Accept ►
          </button>
        </div>
      )}

      {columnId === "preparing" && order.status === "accepted" && (
        <button
          type="button"
          disabled={busy}
          onClick={onStartPreparing}
          className="mt-3 w-full rounded-lg bg-yellow-600 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-yellow-500 disabled:opacity-50"
        >
          Start Preparing
        </button>
      )}

      {columnId === "preparing" && order.status === "preparing" && (
        <button
          type="button"
          disabled={busy}
          onClick={onMarkReady}
          className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          Mark Ready
        </button>
      )}

      {columnId === "ready" && (
        <button
          type="button"
          disabled={busy}
          onClick={onMarkDelivered}
          className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          Mark Delivered
        </button>
      )}
    </motion.article>
  );
}

function resolveDropStatus(
  fromStatus: string,
  targetColumn: ColumnDef["id"]
): OrderStatus | null {
  if (targetColumn === "new") return null;
  if (targetColumn === "preparing") {
    if (fromStatus === "pending") return "accepted";
    if (fromStatus === "accepted") return "preparing";
    return null;
  }
  if (targetColumn === "ready") {
    if (fromStatus === "preparing" || fromStatus === "accepted") return "ready";
    return null;
  }
  if (targetColumn === "delivered") {
    if (fromStatus === "ready") return "delivered";
    return null;
  }
  return null;
}

function DroppableColumn({
  column,
  children,
}: {
  column: ColumnDef;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[300px] flex-1 flex-col rounded-xl bg-zinc-900/30 p-3",
        "border-t-2",
        column.border,
        isOver && "ring-2 ring-orange-500/40"
      )}
    >
      {children}
    </div>
  );
}

function DraggableOrderCard({
  order,
  currency,
  busy,
  onAccept,
  onReject,
  onStartPreparing,
  onMarkReady,
  onMarkDelivered,
}: {
  order: OrderWithDetails;
  currency: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onMarkDelivered: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(isDragging && "opacity-40")}
    >
      <OrderCard
        order={order}
        currency={currency}
        busy={busy}
        onAccept={onAccept}
        onReject={onReject}
        onStartPreparing={onStartPreparing}
        onMarkReady={onMarkReady}
        onMarkDelivered={onMarkDelivered}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[200px] animate-pulse rounded-xl bg-zinc-800"
        />
      ))}
    </>
  );
}

export function OrderBoard() {
  const { locationId, currency } = useDashboard();
  const { play } = useSoundAlert();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrderWithDetails | null>(
    null
  );
  const prevPendingRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchOrders = useCallback(async () => {
    const supabase = createClient();
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso())
      .in("status", [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "delivered",
      ])
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setOrders((data as unknown as OrderWithDetails[]) ?? []);
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      await fetchOrders();
      if (!cancelled) setLoading(false);
    })();

    const supabase = createClient();
    const channel = supabase
      .channel(`orders-realtime:${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `location_id=eq.${locationId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data } = await supabase
              .from("orders")
              .select(ORDER_SELECT)
              .eq("id", (payload.new as { id: string }).id)
              .single();

            if (data) {
              const order = data as unknown as OrderWithDetails;
              const created = new Date(order.created_at);
              if (created >= new Date(startOfTodayIso())) {
                setOrders((prev) => {
                  if (prev.some((o) => o.id === order.id)) return prev;
                  return [order, ...prev];
                });
              }
            }
            return;
          }

          if (payload.eventType === "UPDATE") {
            const row = payload.new as { id: string; status: string };
            if (["rejected", "cancelled"].includes(row.status)) {
              setOrders((prev) => prev.filter((o) => o.id !== row.id));
              return;
            }

            const { data } = await supabase
              .from("orders")
              .select(ORDER_SELECT)
              .eq("id", row.id)
              .single();

            if (data) {
              const order = data as unknown as OrderWithDetails;
              setOrders((prev) => {
                const exists = prev.some((o) => o.id === order.id);
                if (!exists) return [order, ...prev];
                return prev.map((o) => (o.id === order.id ? order : o));
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchOrders]);

  useEffect(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    if (pending > prevPendingRef.current && !loading) {
      play("new-order");
      toast.info("New order received");
    }
    prevPendingRef.current = pending;
  }, [orders, loading, play]);

  const patchOrder = useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      rejectionReason?: string
    ) => {
      setBusyId(orderId);
      let snapshot: OrderWithDetails[] = [];
      setOrders((prev) => {
        snapshot = prev;
        return status === "rejected"
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      });

      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, rejectionReason }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Update failed");
        }
        await fetchOrders();
      } catch (e) {
        setOrders(snapshot);
        toast.error(e instanceof Error ? e.message : "Update failed", {
          action: {
            label: "Retry",
            onClick: () => patchOrder(orderId, status, rejectionReason),
          },
        });
      } finally {
        setBusyId(null);
      }
    },
    [fetchOrders]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const order = orders.find((o) => o.id === active.id);
    if (!order) return;

    let targetColumn = over.id as ColumnDef["id"];
    if (!COLUMNS.some((c) => c.id === targetColumn)) {
      const overOrder = orders.find((o) => o.id === over.id);
      if (!overOrder) return;
      targetColumn = getColumnId(overOrder.status);
    }

    const nextStatus = resolveDropStatus(order.status, targetColumn);
    if (nextStatus && nextStatus !== order.status) {
      patchOrder(order.id, nextStatus);
    }
  }

  const activeOrder = activeId
    ? orders.find((o) => o.id === activeId)
    : null;

  const sortColumn = (list: OrderWithDetails[]) =>
    [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  if (error && !loading) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => fetchOrders()}
          className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((column) => {
            const colOrders = sortColumn(
              orders.filter((o) => column.statuses.includes(o.status))
            );

            return (
              <DroppableColumn key={column.id} column={column}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                    {column.label}
                  </h3>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                      column.badge
                    )}
                  >
                    {colOrders.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {loading ? (
                    <ColumnSkeleton />
                  ) : colOrders.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      No orders
                    </p>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {colOrders.map((order) => (
                        <DraggableOrderCard
                          key={order.id}
                          order={order}
                          currency={currency}
                          busy={busyId === order.id}
                          onAccept={() => patchOrder(order.id, "accepted")}
                          onReject={() => setRejectTarget(order)}
                          onStartPreparing={() =>
                            patchOrder(order.id, "preparing")
                          }
                          onMarkReady={() => patchOrder(order.id, "ready")}
                          onMarkDelivered={() =>
                            patchOrder(order.id, "delivered")
                          }
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeOrder ? (
            <div className="rotate-2 opacity-90">
              <OrderCard
                order={activeOrder}
                currency={currency}
                busy={false}
                onAccept={() => {}}
                onReject={() => {}}
                onStartPreparing={() => {}}
                onMarkReady={() => {}}
                onMarkDelivered={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <RejectOrderDialog
        open={!!rejectTarget}
        orderNumber={rejectTarget?.order_number ?? 0}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          await patchOrder(rejectTarget.id, "rejected", reason);
        }}
      />
    </div>
  );
}
