import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = [
  { label: "NEW", border: "border-t-[var(--status-new)]" },
  { label: "PREPARING", border: "border-t-[var(--status-preparing)]" },
  { label: "READY", border: "border-t-[var(--status-ready)]" },
] as const;

function OrderCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16 bg-dash-surface-raised" />
        <Skeleton className="h-5 w-20 rounded-full bg-dash-surface-raised" />
      </div>
      <Skeleton className="h-px w-full bg-dash-surface-raised" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-dash-surface-raised" />
        <Skeleton className="h-4 w-4/5 bg-dash-surface-raised" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg bg-dash-surface-raised" />
    </div>
  );
}

export default function OrdersLoading() {
  return (
    <div className="bg-dash-bg">
      <div className="mb-4 flex gap-2 md:hidden">
        {COLUMNS.map((col) => (
          <Skeleton key={col.label} className="h-9 flex-1 rounded-lg bg-dash-surface-raised" />
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <div
            key={col.label}
            className={`flex min-w-[280px] flex-1 flex-col rounded-xl bg-dash-surface/30 p-3 border-t-2 ${col.border}`}
          >
            <Skeleton className="mb-3 h-5 w-24 bg-dash-surface-raised" />
            <div className="space-y-3">
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
