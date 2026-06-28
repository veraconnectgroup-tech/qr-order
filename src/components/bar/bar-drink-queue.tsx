"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useBarOrders } from "@/hooks/use-bar-orders";
import { BarOrderRow } from "@/components/bar/bar-order-row";
import { SoundEnableBanner } from "@/components/dashboard/sound-enable-banner";
import { cn } from "@/lib/utils";

export function BarDrinkQueue() {
  const { locationId, currency } = useDashboard();
  const {
    queue,
    rounds,
    refillHints,
    stats,
    loading,
    error,
    refetch,
    optimisticUpdateStatus,
  } = useBarOrders(locationId);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-36 rounded-xl bg-dash-surface-raised"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300">
        Failed to load drink queue: {error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SoundEnableBanner />

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-dash-text">Drink queue</h1>
          <p className="text-xs text-dash-text-muted">
            Denis prioritizuje pića po hitnosti
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-12 rounded-lg px-3 text-sm font-medium text-orange-400 hover:bg-dash-surface-raised"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label="Pića / sat" value={String(stats.drinksLastHour)} />
        <StatCard
          label="Top koktel"
          value={stats.topCocktail ?? "—"}
        />
        <StatCard
          label="Avg prep"
          value={
            stats.avgPrepMinutes != null ? `${stats.avgPrepMinutes} min` : "—"
          }
        />
      </div>

      {refillHints.length > 0 ? (
        <section className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <h2 className="text-sm font-semibold text-amber-200">
            Refill intelligence
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-100/90">
            {refillHints.map((hint) => (
              <li key={`${hint.tableId}-${hint.drinkName}`}>{hint.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {rounds.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dash-text-secondary">
            Round detection
          </h2>
          {rounds.map((round) => (
            <div
              key={`${round.tableId}-${round.drinkKey}`}
              className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3"
            >
              <p className="text-base font-semibold text-orange-100">
                {round.summary}
              </p>
              <p className="mt-1 text-xs text-orange-200/80">
                Pripremi zajedno · {round.orderIds.length} order(s)
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {queue.length === 0 ? (
        <p className="rounded-xl border border-dashed border-dash-border-subtle px-4 py-12 text-center text-sm text-dash-text-muted">
          No drink orders in queue
        </p>
      ) : (
        <div className={cn("space-y-3")}>
          {queue.map((entry) => (
            <BarOrderRow
              key={entry.order.id}
              entry={entry}
              currency={currency}
              busy={busyOrderId === entry.order.id}
              onBusyChange={(busy) =>
                setBusyOrderId(busy ? entry.order.id : null)
              }
              onUpdated={() => void refetch()}
              onOptimisticStatus={optimisticUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-dash-border-subtle bg-dash-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-dash-text-muted">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-dash-text">
        {value}
      </p>
    </div>
  );
}
