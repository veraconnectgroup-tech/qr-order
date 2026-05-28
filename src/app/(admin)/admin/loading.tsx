import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="p-6">
      <Skeleton className="mb-6 h-8 w-48 bg-dash-surface-raised" />

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <Skeleton className="h-4 w-20 bg-dash-surface-raised" />
            <Skeleton className="mt-3 h-8 w-16 bg-dash-surface-raised" />
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg bg-dash-surface-raised" />
        <Skeleton className="h-64 w-full rounded-lg bg-dash-surface-raised" />
      </div>
    </div>
  );
}
