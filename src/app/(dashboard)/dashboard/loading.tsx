import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-zinc-800" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-xl bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
