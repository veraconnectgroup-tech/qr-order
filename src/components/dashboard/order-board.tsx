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
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DASHBOARD_POLL_INTERVAL_MS } from "@/lib/constants";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import {
  getOrderColumnId,
  ORDER_COLUMNS,
  OrderCard,
  type OrderColumnDef,
} from "@/components/dashboard/order-card";
import { RejectOrderDialog } from "@/components/dashboard/reject-order-dialog";
import { useSoundAlert } from "@/hooks/use-sound-alert";
import { cn } from "@/lib/utils";
import type { OrderStatus, OrderWithDetails } from "@/types";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name))";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function resolveDropStatus(
  fromStatus: string,
  targetColumn: OrderColumnDef["id"]
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
  column: OrderColumnDef;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-xl bg-zinc-900/30 p-3 md:min-w-[300px]",
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
  const [mobileColumn, setMobileColumn] =
    useState<OrderColumnDef["id"]>("new");
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
        () => {
          if (!cancelled) fetchOrders();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          fetchOrders();
        }
      });

    const pollId = setInterval(() => {
      if (!cancelled) fetchOrders();
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
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

    let targetColumn = over.id as OrderColumnDef["id"];
    if (!ORDER_COLUMNS.some((c) => c.id === targetColumn)) {
      const overOrder = orders.find((o) => o.id === over.id);
      if (!overOrder) return;
      targetColumn = getOrderColumnId(overOrder.status);
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

  function renderOrderCard(order: OrderWithDetails, draggable = true) {
    const handlers = {
      busy: busyId === order.id,
      onAccept: () => patchOrder(order.id, "accepted"),
      onReject: () => setRejectTarget(order),
      onStartPreparing: () => patchOrder(order.id, "preparing"),
      onMarkReady: () => patchOrder(order.id, "ready"),
      onMarkDelivered: () => patchOrder(order.id, "delivered"),
    };

    if (draggable) {
      return (
        <DraggableOrderCard
          key={order.id}
          order={order}
          currency={currency}
          {...handlers}
        />
      );
    }

    return (
      <OrderCard
        key={order.id}
        order={order}
        currency={currency}
        {...handlers}
      />
    );
  }

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
      {/* Mobile: column tabs + vertical list */}
      <div className="md:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ORDER_COLUMNS.map((column) => {
            const count = orders.filter((o) =>
              column.statuses.includes(o.status)
            ).length;
            const active = mobileColumn === column.id;
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => setMobileColumn(column.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition touch-manipulation sm:px-3 sm:py-1.5",
                  active
                    ? "bg-orange-500 text-white"
                    : "bg-zinc-800 text-zinc-400"
                )}
              >
                {column.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {loading ? (
            <ColumnSkeleton />
          ) : (
            (() => {
              const column = ORDER_COLUMNS.find((c) => c.id === mobileColumn)!;
              const colOrders = sortColumn(
                orders.filter((o) => column.statuses.includes(o.status))
              );
              if (colOrders.length === 0) {
                return (
                  <p className="py-12 text-center text-sm text-zinc-500">
                    No orders
                  </p>
                );
              }
              return colOrders.map((order) => renderOrderCard(order, false));
            })()
          )}
        </div>
      </div>

      {/* Desktop: kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden gap-4 overflow-x-auto pb-2 md:flex">
          {ORDER_COLUMNS.map((column) => {
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
                      {colOrders.map((order) => renderOrderCard(order))}
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
