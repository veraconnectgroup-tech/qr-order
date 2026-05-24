"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useReceiptAutoPrint } from "@/hooks/use-receipt-auto-print";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import {
  DELIVERED_BOARD_MAX_VISIBLE,
  getDeliveredTimestamp,
  getOrderColumnId,
  isDeliveredVisibleOnBoard,
  ORDER_COLUMNS,
  OrderCard,
  type OrderColumnDef,
} from "@/components/dashboard/order-card";
import { RejectOrderDialog } from "@/components/dashboard/reject-order-dialog";
import { RefundOrderDialog } from "@/components/dashboard/refund-order-dialog";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { LiveConnectionBadge } from "@/components/dashboard/live-connection-badge";
import { SoundEnableBanner } from "@/components/dashboard/sound-enable-banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import {
  buildTransferSourceMap,
  type TableTransferRow,
} from "@/lib/tables/transfer-source-map";
import type { OrderStatus, OrderWithDetails } from "@/types";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name)), tip_staff:tip_staff_id(name), split_payments(*), order_channel_deliveries(*)";

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
        "flex min-w-0 flex-1 flex-col rounded-xl bg-dash-surface/30 p-3 md:min-w-[300px]",
        "border-t-2",
        column.border,
        isOver && "ring-2 ring-dash-accent/40 bg-dash-accent-subtle"
      )}
    >
      {children}
    </div>
  );
}

function DraggableOrderCard({
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
  inPersonPaymentLocation,
  fiscalTssEnabled,
}: {
  order: OrderWithDetails;
  currency: string;
  orgName: string;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onApproveAccess?: () => void;
  onStartPreparing: () => void;
  onMarkReady: () => void;
  onMarkDelivered: () => void;
  onRefund?: () => void;
  staffRole: string;
  inPersonPaymentLocation: "bar" | "counter" | "table";
  fiscalTssEnabled: boolean;
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
        orgName={orgName}
        busy={busy}
        onAccept={onAccept}
        onReject={onReject}
        onApproveAccess={onApproveAccess}
        onStartPreparing={onStartPreparing}
        onMarkReady={onMarkReady}
        onMarkDelivered={onMarkDelivered}
        onRefund={onRefund}
        staffRole={staffRole}
        dragHandleProps={{ ...attributes, ...listeners }}
        inPersonPaymentLocation={inPersonPaymentLocation}
        fiscalTssEnabled={fiscalTssEnabled}
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
          className="h-[200px] animate-pulse rounded-xl bg-dash-surface-raised"
        />
      ))}
    </>
  );
}

export function OrderBoard() {
  const {
    locationId,
    orgName,
    currency,
    stripeOnboarded,
    hasTables,
    hasMenuItems,
    staffRole,
    inPersonPaymentLocation,
    fiscalTssEnabled,
  } = useDashboard();
  const { refreshAlerts } = useDashboardAlerts();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrderWithDetails | null>(
    null
  );
  const [refundTarget, setRefundTarget] = useState<OrderWithDetails | null>(
    null
  );
  const [mobileColumn, setMobileColumn] =
    useState<OrderColumnDef["id"]>("new");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [, tickUpdated] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useReceiptAutoPrint({ orders, orgName, currency });

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const id = setInterval(() => tickUpdated((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  const fetchOrders = useCallback(async () => {
    const supabase = createClient();
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso())
      .in("status", [
        "pending_approval",
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

    const { data: transfers } = await supabase
      .from("table_transfers")
      .select("order_ids, from_table:from_table_id(name)")
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso());

    const transferMap = buildTransferSourceMap(
      (transfers ?? []) as unknown as TableTransferRow[]
    );

    const enriched = ((data ?? []) as OrderWithDetails[]).map((order) => ({
      ...order,
      transferred_from_table_name: transferMap.get(order.id) ?? null,
    }));

    setOrders(enriched);
    setLastUpdatedAt(new Date());
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      await fetchOrders();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchOrders]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void fetchOrders();
      }
    }

    function onFocus() {
      void fetchOrders();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchOrders]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchOrders();
    }, REALTIME_FALLBACK_POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchOrders]);

  const realtimeMode = usePostgresRealtime({
    channelName: `orders-realtime:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    backupPollMs: REALTIME_FALLBACK_POLL_MS,
  });

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
        await refreshAlerts();
      } catch (e) {
        setOrders(snapshot);
        const message = e instanceof Error ? e.message : "Update failed";
        toast.error(message, {
          action: {
            label: "Retry",
            onClick: () => patchOrder(orderId, status, rejectionReason),
          },
        });
      } finally {
        setBusyId(null);
        await fetchOrders();
      }
    },
    [fetchOrders, refreshAlerts]
  );

  const approveAccess = useCallback(
    async (orderId: string) => {
      setBusyId(orderId);
      try {
        const res = await fetch(`/api/orders/${orderId}/approve-access`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Approval failed");
        }
        toast.success("Order approved — sent to kitchen");
        await refreshAlerts();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Approval failed";
        if (message.includes("not awaiting approval")) {
          toast.info("Order already approved");
        } else {
          toast.error(message);
        }
      } finally {
        setBusyId(null);
        await fetchOrders();
      }
    },
    [fetchOrders, refreshAlerts]
  );

  const rejectAccess = useCallback(
    async (orderId: string, rejectionReason?: string) => {
      setBusyId(orderId);
      try {
        const res = await fetch(`/api/orders/${orderId}/approve-access`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Reject failed");
        }
        if (json.data?.deviceBlocked) {
          toast.success("Order declined — device blocked from ordering");
        } else {
          toast.success("Order declined");
        }
        await fetchOrders();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reject failed");
      } finally {
        setBusyId(null);
      }
    },
    [fetchOrders]
  );

  const refundOrder = useCallback(
    async (orderId: string, reason: string, amount?: number) => {
      setBusyId(orderId);
      try {
        const res = await fetch(`/api/orders/${orderId}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, amount }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Refund failed");
        }
        toast.success("Refund issued");
        await fetchOrders();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Refund failed");
        throw e;
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

  const sortDeliveredColumn = (list: OrderWithDetails[]) =>
    [...list].sort(
      (a, b) => getDeliveredTimestamp(b) - getDeliveredTimestamp(a)
    );

  function getColumnBoardOrders(column: OrderColumnDef): {
    visible: OrderWithDetails[];
    hiddenCount: number;
    totalCount: number;
  } {
    if (column.id === "delivered") {
      const qualifying = sortDeliveredColumn(
        orders.filter(
          (o) => o.status === "delivered" && isDeliveredVisibleOnBoard(o)
        )
      );
      return {
        visible: qualifying.slice(0, DELIVERED_BOARD_MAX_VISIBLE),
        hiddenCount: Math.max(
          0,
          qualifying.length - DELIVERED_BOARD_MAX_VISIBLE
        ),
        totalCount: qualifying.length,
      };
    }

    const colOrders = sortColumn(
      orders.filter((o) => column.statuses.includes(o.status))
    );
    return { visible: colOrders, hiddenCount: 0, totalCount: colOrders.length };
  }

  // Re-evaluate delivered age cutoffs (30 min fade, 60 min hide)
  const [, setDeliveredTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDeliveredTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  function renderOrderCard(order: OrderWithDetails, draggable = true) {
    const canRefund =
      order.payment_status === "paid" &&
      order.payment_method === "online" &&
      ["owner", "manager"].includes(staffRole);

    const handlers = {
      busy: busyId === order.id,
      onAccept: () => patchOrder(order.id, "accepted"),
      onReject: () =>
        order.status === "pending_approval"
          ? rejectAccess(order.id)
          : setRejectTarget(order),
      onApproveAccess:
        order.status === "pending_approval"
          ? () => approveAccess(order.id)
          : undefined,
      onStartPreparing: () => patchOrder(order.id, "preparing"),
      onMarkReady: () => patchOrder(order.id, "ready"),
      onMarkDelivered: () => patchOrder(order.id, "delivered"),
      onRefund: canRefund ? () => setRefundTarget(order) : undefined,
      staffRole,
    };

    if (draggable) {
      return (
        <DraggableOrderCard
          key={order.id}
          order={order}
          currency={currency}
          orgName={orgName}
          inPersonPaymentLocation={inPersonPaymentLocation}
          fiscalTssEnabled={fiscalTssEnabled}
          {...handlers}
        />
      );
    }

    return (
      <OrderCard
        key={order.id}
        order={order}
        currency={currency}
        orgName={orgName}
        inPersonPaymentLocation={inPersonPaymentLocation}
        fiscalTssEnabled={fiscalTssEnabled}
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
          className="mt-4 rounded-lg bg-dash-surface-raised px-4 py-2 text-sm text-dash-text-secondary hover:bg-dash-surface-overlay"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <SoundEnableBanner />
      <div className="mb-3 flex items-center justify-between gap-3">
        {staffRole !== "kitchen" && (
          <Button
            asChild
            size="sm"
            className="bg-dash-accent text-white hover:bg-dash-accent-hover"
          >
            <Link href="/dashboard/new-order">
              <Plus />
              New Order
            </Link>
          </Button>
        )}
        <div className="ml-auto flex flex-col items-end gap-0.5">
          {lastUpdatedAt && (
            <span className="text-xs text-muted-foreground">
              Aktualisiert vor{" "}
              {Math.max(
                0,
                Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000)
              )}
              s
            </span>
          )}
          <LiveConnectionBadge mode={realtimeMode} />
        </div>
      </div>
      <SetupChecklist
        stripeOnboarded={stripeOnboarded}
        hasTables={hasTables}
        hasMenuItems={hasMenuItems}
        canEdit={["owner", "manager"].includes(staffRole)}
      />
      {/* Mobile: column tabs + vertical list */}
      <div className="md:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ORDER_COLUMNS.map((column) => {
            const { totalCount } = getColumnBoardOrders(column);
            const active = mobileColumn === column.id;
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => setMobileColumn(column.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all touch-manipulation sm:px-3 sm:py-1.5",
                  active
                    ? "bg-dash-accent text-white shadow-[var(--shadow-sm)]"
                    : "bg-dash-surface-raised text-dash-text-muted hover:text-dash-text-secondary"
                )}
              >
                {column.label} ({totalCount})
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            "space-y-2",
            mobileColumn === "delivered" &&
              "max-h-[calc(100vh-200px)] overflow-y-auto [scrollbar-width:thin]"
          )}
        >
          {loading ? (
            <ColumnSkeleton />
          ) : (
            (() => {
              const column = ORDER_COLUMNS.find((c) => c.id === mobileColumn)!;
              const { visible, hiddenCount } = getColumnBoardOrders(column);
              if (visible.length === 0) {
                return (
                  <p className="py-12 text-center text-sm text-dash-text-disabled">
                    No orders
                  </p>
                );
              }
              return (
                <>
                  {visible.map((order) => renderOrderCard(order, false))}
                  {hiddenCount > 0 && (
                    <Link
                      href="/dashboard/history"
                      className="block py-2 text-center text-sm text-dash-text-muted transition hover:text-dash-accent"
                    >
                      +{hiddenCount} more · View in History
                    </Link>
                  )}
                </>
              );
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
            const { visible, hiddenCount, totalCount } =
              getColumnBoardOrders(column);

            return (
              <DroppableColumn key={column.id} column={column}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-text-muted">
                    {column.label}
                  </h3>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                      column.badge
                    )}
                  >
                    {totalCount}
                  </span>
                </div>

                <div
                  className={cn(
                    "flex flex-col gap-2",
                    column.id === "delivered" &&
                      "max-h-[calc(100vh-200px)] overflow-y-auto [scrollbar-width:thin]"
                  )}
                >
                  {loading ? (
                    <ColumnSkeleton />
                  ) : visible.length === 0 ? (
                    <p className="py-8 text-center text-sm text-dash-text-disabled">
                      No orders
                    </p>
                  ) : (
                    <>
                      <AnimatePresence mode="popLayout">
                        {visible.map((order) => renderOrderCard(order))}
                      </AnimatePresence>
                      {hiddenCount > 0 && (
                        <Link
                          href="/dashboard/history"
                          className="py-2 text-center text-sm text-dash-text-muted transition hover:text-dash-accent"
                        >
                          +{hiddenCount} more · View in History
                        </Link>
                      )}
                    </>
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
                orgName={orgName}
                busy={false}
                inPersonPaymentLocation={inPersonPaymentLocation}
                fiscalTssEnabled={fiscalTssEnabled}
                onAccept={() => {}}
                onReject={() => {}}
                onStartPreparing={() => {}}
                onMarkReady={() => {}}
                onMarkDelivered={() => {}}
                staffRole={staffRole}
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

      <RefundOrderDialog
        open={!!refundTarget}
        orderNumber={refundTarget?.order_number ?? 0}
        orderTotal={Number(refundTarget?.total ?? 0)}
        currency={currency}
        onClose={() => setRefundTarget(null)}
        onConfirm={async (reason, amount) => {
          if (!refundTarget) return;
          await refundOrder(refundTarget.id, reason, amount);
        }}
      />
    </div>
  );
}
