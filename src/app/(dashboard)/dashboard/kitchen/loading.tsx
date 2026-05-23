import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="flex h-14 items-center justify-between px-4">
          <Skeleton className="h-4 w-32 bg-zinc-800" />
          <Skeleton className="h-8 w-28 bg-zinc-800" />
          <Skeleton className="h-8 w-24 bg-zinc-800" />
        </div>
        <div className="flex gap-4 border-t border-zinc-800 bg-zinc-900 px-4 py-2">
          <Skeleton className="h-4 w-20 bg-zinc-800" />
          <Skeleton className="h-4 w-24 bg-zinc-800" />
          <Skeleton className="h-4 w-24 bg-zinc-800" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}
