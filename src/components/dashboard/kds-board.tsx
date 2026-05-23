"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatOrderNumber } from "@/lib/format";
import { getKitchenOrderItems } from "@/lib/kitchen/menu-section";
import {
  isKdsAutoPrintEnabled,
  setKdsAutoPrintEnabled,
  getKdsTimerWarningMinutes,
  setKdsTimerWarningMinutes,
  formatKdsElapsed,
  kdsElapsedMinutes,
} from "@/lib/kds/settings";
import {
  isKdsSoundEnabled,
  setKdsSoundEnabled,
  playNewOrderSound,
} from "@/lib/audio/notification-sound";
import { printKitchenTicket } from "@/lib/kitchen/print-ticket";
import {
  kdsActionLabel,
  nextKdsStatus,
  patchOrderStatus,
} from "@/lib/orders/patch-order-status";
import { useKdsOrders } from "@/hooks/use-kds-orders";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { KdsConnectionBadge } from "@/components/dashboard/kds-connection-badge";
import { KitchenPrintButton } from "@/components/dashboard/kitchen-print-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

const KDS_COLUMNS = [
  { id: "pending", title: "New", statuses: ["pending"] },
  { id: "accepted", title: "Accepted", statuses: ["accepted"] },
  { id: "preparing", title: "Preparing", statuses: ["preparing"] },
  { id: "ready", title: "Ready", statuses: ["ready", "delivered"] },
] as const;

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(
        new Date().toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-2xl tabular-nums text-zinc-100">{time}</span>
  );
}

function KdsOrderCard({
  order,
  timerWarningMin,
  busy,
  orgName,
  onAdvance,
}: {
  order: OrderWithDetails;
  timerWarningMin: number;
  busy: boolean;
  orgName: string;
  onAdvance: () => void;
}) {
  const [, tick] = useState(0);
  const tableName = order.tables?.name ?? "—";
  const items = getKitchenOrderItems(order);
  const isDelivered = order.status === "delivered";
  const elapsed = formatKdsElapsed(order.created_at);
  const minutes = kdsElapsedMinutes(order.created_at);
  const isLate = minutes >= timerWarningMin;
  const actionLabel = isDelivered ? null : kdsActionLabel(order.status);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={cn(
        "rounded-2xl border-2 bg-zinc-900 p-4 shadow-lg",
        isDelivered
          ? "border-zinc-700 opacity-60"
          : isLate
            ? "border-red-500 animate-pulse"
            : order.status === "pending"
              ? "border-orange-500"
              : order.status === "accepted"
                ? "border-blue-500"
                : order.status === "preparing"
                  ? "border-amber-500"
                  : "border-green-500"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-4xl font-black tracking-tight text-zinc-50">
          {formatOrderNumber(order.order_number)}
        </p>
        <div className="text-right">
          <span className="block rounded-lg bg-zinc-800 px-3 py-1 text-lg font-semibold text-zinc-200">
            Sto {tableName}
          </span>
          <span
            className={cn(
              "mt-2 block font-mono text-2xl font-bold tabular-nums",
              isLate ? "text-red-400" : "text-emerald-400"
            )}
          >
            {elapsed}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <p className="text-xl font-semibold text-zinc-100">
              <span className="mr-2 text-2xl font-black text-orange-400">
                {item.quantity}×
              </span>
              {item.product_name}
            </p>
            {item.order_item_modifiers?.map((m) => (
              <p key={m.id} className="pl-8 text-lg text-zinc-400">
                → {m.modifier_name}
              </p>
            ))}
            {item.notes && (
              <p className="pl-8 text-lg italic text-amber-300/90">
                → {item.notes}
              </p>
            )}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mt-3 border-l-4 border-amber-500 pl-3 text-lg italic text-amber-300">
          {order.notes}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {actionLabel && (
          <button
            type="button"
            disabled={busy}
            onClick={onAdvance}
            className="min-h-14 flex-1 rounded-xl bg-orange-500 px-4 text-lg font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 touch-manipulation"
          >
            {actionLabel}
          </button>
        )}
        {isDelivered && (
          <p className="flex min-h-14 flex-1 items-center justify-center rounded-xl bg-zinc-800 text-lg font-semibold text-zinc-400">
            Dostavljeno
          </p>
        )}
        <KitchenPrintButton
          order={order}
          orgName={orgName}
          className="min-h-14 px-4 text-base"
        />
      </div>
    </motion.div>
  );
}

export function KdsBoard() {
  const router = useRouter();
  const { locationId, orgName } = useDashboard();
  const { orders, loading, error, refetch, realtimeMode } =
    useKdsOrders(locationId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [autoPrint, setAutoPrintState] = useState(false);
  const [timerWarningMin, setTimerWarningMinState] = useState(10);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    setSoundEnabledState(isKdsSoundEnabled());
    setAutoPrintState(isKdsAutoPrintEnabled());
    setTimerWarningMinState(getKdsTimerWarningMinutes());
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    void el.requestFullscreen?.().catch(() => {});
    setIsFullscreen(Boolean(document.fullscreenElement));

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement === el) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const exitKds = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.().catch(() => {});
    }
    router.push("/dashboard/kitchen");
  }, [router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void exitKds();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitKds]);

  useEffect(() => {
    if (loading) return;

    const currentIds = new Set(orders.map((order) => order.id));

    if (!initializedRef.current) {
      seenIdsRef.current = currentIds;
      initializedRef.current = true;
      return;
    }

    const newOrders = orders.filter((order) => !seenIdsRef.current.has(order.id));
    if (newOrders.length > 0) {
      playNewOrderSound();
      if (isKdsAutoPrintEnabled()) {
        for (const order of newOrders) {
          printKitchenTicket(order, orgName);
        }
      }
    }

    seenIdsRef.current = currentIds;
  }, [orders, loading, orgName]);

  const ordersByColumn = useMemo(() => {
    const map = new Map<string, OrderWithDetails[]>();
    for (const column of KDS_COLUMNS) {
      map.set(
        column.id,
        orders
          .filter((order) =>
            (column.statuses as readonly string[]).includes(order.status)
          )
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
      );
    }
    return map;
  }, [orders]);

  const advanceOrder = useCallback(
    async (order: OrderWithDetails) => {
      const next = nextKdsStatus(order.status);
      if (!next) return;

      setBusyId(order.id);
      try {
        await patchOrderStatus(order.id, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
        await refetch();
      } finally {
        setBusyId(null);
      }
    },
    [refetch]
  );

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.().catch(() => {});
    } else {
      await document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-50">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-zinc-100">{orgName}</p>
          <p className="text-sm text-zinc-500">Kitchen Display System</p>
        </div>
        <LiveClock />
        <div className="flex items-center gap-2">
          <KdsConnectionBadge mode={realtimeMode} />
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
            aria-label="Settings"
          >
            <Settings2 className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="size-5" />
            ) : (
              <Maximize2 className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void exitKds()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 hover:bg-zinc-900"
          >
            <X className="size-4" />
            Exit
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div className="border-b border-zinc-800 bg-zinc-900/90 px-4 py-4">
          <div className="mx-auto flex max-w-4xl flex-wrap items-end gap-6">
            <label className="block space-y-1">
              <span className="text-sm text-zinc-400">
                Timer warning (min)
              </span>
              <input
                type="number"
                min={1}
                max={120}
                value={timerWarningMin}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setTimerWarningMinState(value);
                  setKdsTimerWarningMinutes(value);
                }}
                className="h-11 w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-lg text-zinc-100"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => {
                  setSoundEnabledState(e.target.checked);
                  setKdsSoundEnabled(e.target.checked);
                }}
                className="size-5 rounded border-zinc-600"
              />
              Sound alert
              {soundEnabled ? (
                <Volume2 className="size-4 text-emerald-400" />
              ) : (
                <VolumeX className="size-4 text-zinc-500" />
              )}
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => {
                  setAutoPrintState(e.target.checked);
                  setKdsAutoPrintEnabled(e.target.checked);
                }}
                className="size-5 rounded border-zinc-600"
              />
              Auto-print kitchen ticket
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-300">
          {error}{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="underline hover:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid flex-1 grid-cols-2 gap-4 p-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-2xl bg-zinc-900" />
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          {KDS_COLUMNS.map((column) => {
            const columnOrders = ordersByColumn.get(column.id) ?? [];
            return (
              <section
                key={column.id}
                className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-950/80"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <h2 className="text-xl font-bold text-zinc-100">
                    {column.title}
                  </h2>
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm font-semibold text-zinc-300">
                    {columnOrders.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  <AnimatePresence mode="popLayout">
                    {columnOrders.length === 0 ? (
                      <p className="py-8 text-center text-base text-zinc-600">
                        —
                      </p>
                    ) : (
                      columnOrders.map((order) => (
                        <KdsOrderCard
                          key={order.id}
                          order={order}
                          timerWarningMin={timerWarningMin}
                          busy={busyId === order.id}
                          orgName={orgName}
                          onAdvance={() => advanceOrder(order)}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
