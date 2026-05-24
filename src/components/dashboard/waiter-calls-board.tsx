"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  useRealtimeWaiterCalls,
  type WaiterCallWithTable,
} from "@/hooks/use-realtime-waiter-calls";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { SoundToggle } from "@/components/dashboard/sound-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/components/waiter/use-pull-to-refresh";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";
import { hapticClick, hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";

function formatTimeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function isRecentlyCreated(iso: string) {
  return Date.now() - new Date(iso).getTime() < 10_000;
}

function PendingCallCard({
  call,
  staffFirstName,
  onDismiss,
  onAcknowledge,
  tick,
  t,
}: {
  call: WaiterCallWithTable;
  staffFirstName: string;
  onDismiss: () => void;
  onAcknowledge: () => void;
  tick: number;
  t: ReturnType<typeof useWaiterI18n>["t"];
}) {
  void tick;
  const tableName = call.tables?.name ?? "Table";
  const zoneName = call.tables?.zone?.name;
  const isNew = isRecentlyCreated(call.created_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "rounded-xl border border-red-500/30 border-l-4 border-l-red-500 bg-red-500/5 p-5",
        isNew && "animate-pulse"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-dash-text">
            <Bell className="size-5 shrink-0 text-red-400" />
            <span>{tableName.toUpperCase()}</span>
            {zoneName && (
              <span className="text-base font-normal text-dash-text-muted">
                — {zoneName}
              </span>
            )}
          </p>
        </div>
        <p className="shrink-0 text-sm text-dash-text-disabled">
          {formatTimeAgo(call.created_at)}
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => {
            hapticClick();
            onDismiss();
          }}
          className="min-h-12 rounded-lg bg-dash-surface-raised px-4 py-2.5 text-sm text-dash-text-secondary active:bg-dash-surface-overlay"
        >
          {t("calls.dismiss")}
        </button>
        <button
          type="button"
          onClick={() => {
            hapticClick();
            onAcknowledge();
          }}
          className="min-h-12 rounded-lg bg-dash-accent px-6 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
        >
          {t("calls.onMyWay", { name: staffFirstName })}
        </button>
      </div>
    </motion.div>
  );
}

function HandledCallCard({
  call,
  staffName,
  tick,
  t,
}: {
  call: WaiterCallWithTable;
  staffName: string;
  tick: number;
  t: ReturnType<typeof useWaiterI18n>["t"];
}) {
  void tick;
  const tableName = call.tables?.name ?? "Table";
  const zoneName = call.tables?.zone?.name;
  const handledAt =
    call.resolved_at ?? call.acknowledged_at ?? call.created_at;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      className="rounded-xl border border-dash-border bg-dash-surface/30 p-4 opacity-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-base font-semibold text-dash-text-muted">
          {tableName}
          {zoneName && (
            <span className="font-normal text-dash-text-disabled"> — {zoneName}</span>
          )}
        </p>
        <p className="text-sm text-dash-text-disabled">
          {t("calls.handledBy", {
            name: staffName,
            time: formatTimeAgo(handledAt),
          })}
        </p>
      </div>
    </motion.div>
  );
}

export function WaiterCallsBoard({
  variant = "dashboard",
}: {
  variant?: "dashboard" | "waiter";
}) {
  const { locationId, staffName } = useDashboard();
  const { refreshAlerts } = useDashboardAlerts();
  const { calls, loading, refetch } = useRealtimeWaiterCalls(locationId);
  const { t } = useWaiterI18n();
  const [tick, setTick] = useState(0);

  const staffFirstName = staffName.split(" ")[0] ?? staffName;

  const pending = useMemo(
    () =>
      calls
        .filter((c) => c.status === "pending")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [calls]
  );

  const handled = useMemo(
    () =>
      calls
        .filter((c) => c.status !== "pending")
        .sort((a, b) => {
          const aTime = a.resolved_at ?? a.acknowledged_at ?? a.created_at;
          const bTime = b.resolved_at ?? b.acknowledged_at ?? b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }),
    [calls]
  );

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pending.some((c) => isRecentlyCreated(c.created_at))) {
      const id = setInterval(() => setTick((n) => n + 1), 1000);
      return () => clearInterval(id);
    }
  }, [pending]);

  async function updateCall(
    id: string,
    status: "acknowledged" | "resolved"
  ) {
    const supabase = createClient();
    const now = new Date().toISOString();
    const updates =
      status === "acknowledged"
        ? { status, acknowledged_at: now }
        : { status, resolved_at: now };

    const { error } = await supabase
      .from("waiter_calls")
      .update(updates as never)
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    hapticSuccess();
    await refreshAlerts();
  }

  const { bind, indicator, refreshing } = usePullToRefresh({
    onRefresh: refetch,
    disabled: loading,
    hint: t("pull.hint"),
    release: t("pull.release"),
    refreshingLabel: t("pull.refreshing"),
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 bg-dash-surface-raised" />
          <Skeleton className="h-8 w-24 bg-dash-surface-raised" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-dash-surface-raised" />
        ))}
      </div>
    );
  }

  const board = (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        {pending.length > 0 && (
          <span className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-400">
            {t("calls.pending", { count: pending.length })}
          </span>
        )}
        <SoundToggle />
      </div>

      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Bell className="size-16 text-dash-text-disabled" />
          <p className="mt-4 text-xl text-dash-text-disabled">{t("calls.empty")}</p>
          <p className="mt-1 text-dash-text-disabled">{t("calls.emptyHint")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {pending.map((call) => (
              <PendingCallCard
                key={call.id}
                call={call}
                staffFirstName={staffFirstName}
                tick={tick}
                onDismiss={() => updateCall(call.id, "resolved")}
                onAcknowledge={() => updateCall(call.id, "acknowledged")}
                t={t}
              />
            ))}
          </AnimatePresence>

          {pending.length > 0 && handled.length > 0 && (
            <div className="my-6 border-t border-dash-border pt-6">
              <p className="text-xs uppercase tracking-wider text-dash-text-disabled">
                {t("calls.handled")}
              </p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {handled.map((call) => (
              <HandledCallCard
                key={call.id}
                call={call}
                staffName={staffFirstName}
                tick={tick}
                t={t}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  if (variant === "waiter") {
    return (
      <div {...bind}>
        {indicator}
        <div className={cn(refreshing && "opacity-70 transition-opacity")}>
          {board}
        </div>
      </div>
    );
  }

  return board;
}
