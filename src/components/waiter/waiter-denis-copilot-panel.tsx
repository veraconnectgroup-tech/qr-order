"use client";

import Link from "next/link";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useWaiterDenisCopilot } from "@/hooks/use-waiter-denis-copilot";
import type { WaiterCopilotTableRow, WaiterUrgency } from "@/lib/denis/venue/copilot/waiter-copilot-types";
import { cn } from "@/lib/utils";

function urgencyStyles(urgency: WaiterUrgency) {
  switch (urgency) {
    case "red":
      return "border-red-500/40 bg-red-500/10";
    case "yellow":
      return "border-yellow-500/40 bg-yellow-500/10";
    case "green":
      return "border-emerald-500/30 bg-emerald-500/5";
  }
}

function urgencyDot(urgency: WaiterUrgency) {
  switch (urgency) {
    case "red":
      return "bg-red-500";
    case "yellow":
      return "bg-yellow-400";
    case "green":
      return "bg-emerald-500";
  }
}

function PriorityTableRow({ table }: { table: WaiterCopilotTableRow }) {
  return (
    <Link
      href={`/waiter/tables/${table.tableId}`}
      className={cn(
        "block rounded-xl border p-3 active:scale-[0.99]",
        urgencyStyles(table.urgency)
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold text-dash-text">{table.tableName}</p>
          <p className="mt-1 text-xs leading-relaxed text-dash-text-secondary">
            {table.staffBrief ?? table.summary}
          </p>
          {table.suggestedAction ? (
            <p className="mt-1.5 text-xs font-medium text-dash-accent">
              → {table.suggestedAction}
            </p>
          ) : null}
        </div>
        <span className={cn("mt-1 size-3 shrink-0 rounded-full", urgencyDot(table.urgency))} />
      </div>
    </Link>
  );
}

export function WaiterDenisCopilotPanel() {
  const { aiConciergeEnabled } = useDashboard();
  const { data, loading, error } = useWaiterDenisCopilot(aiConciergeEnabled);

  if (!aiConciergeEnabled) return null;

  if (loading) {
    return (
      <section className="space-y-2">
        <Skeleton className="h-5 w-40 rounded bg-dash-surface-raised" />
        <Skeleton className="h-20 rounded-xl bg-dash-surface-raised" />
      </section>
    );
  }

  if (error || !data?.enabled) return null;

  if (data.priorityTables.length === 0) {
    return (
      <section className="rounded-xl border border-dash-border-subtle bg-dash-surface/60 p-4">
        <div className="flex items-center gap-2">
          <DenisMarkBadge size="sm" />
          <p className="text-sm font-semibold text-dash-text">Denis copilot</p>
        </div>
        <p className="mt-2 text-sm text-dash-text-muted">Svi stolovi su mirni.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <DenisMarkBadge size="sm" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dash-text-muted">
          Denis — prioritet
        </h2>
      </div>
      <div className="space-y-2">
        {data.priorityTables.slice(0, 6).map((table) => (
          <PriorityTableRow key={table.tableId} table={table} />
        ))}
      </div>
    </section>
  );
}

export function useWaiterCopilotTableMap() {
  const { aiConciergeEnabled } = useDashboard();
  const { data } = useWaiterDenisCopilot(aiConciergeEnabled);

  if (!data?.enabled) {
    return new Map<string, WaiterCopilotTableRow>();
  }

  return new Map(data.tables.map((table) => [table.tableId, table]));
}
