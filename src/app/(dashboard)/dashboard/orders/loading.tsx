import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = [
  { label: "NEW", border: "border-t-orange-500" },
  { label: "PREPARING", border: "border-t-yellow-500" },
  { label: "READY", border: "border-t-green-500" },
] as const;

function OrderCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16 bg-zinc-800" />
        <Skeleton className="h-5 w-20 rounded-full bg-zinc-800" />
      </div>
      <Skeleton className="h-px w-full bg-zinc-800" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-4/5 bg-zinc-800" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg bg-zinc-800" />
    </div>
  );
}

export default function OrdersLoading() {
  return (
    <div className="bg-zinc-950">
      <div className="mb-4 flex gap-2 md:hidden">
        {COLUMNS.map((col) => (
          <Skeleton key={col.label} className="h-9 flex-1 rounded-lg bg-zinc-800" />
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <div
            key={col.label}
            className={`flex min-w-[280px] flex-1 flex-col rounded-xl bg-zinc-900/30 p-3 border-t-2 ${col.border}`}
          >
            <Skeleton className="mb-3 h-5 w-24 bg-zinc-800" />
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
