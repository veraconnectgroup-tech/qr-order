import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-6 bg-zinc-950">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-zinc-800" />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="grid grid-cols-6 gap-4 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 bg-zinc-800" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-6 gap-4 border-b border-zinc-800/50 px-4 py-4 last:border-b-0"
          >
            {Array.from({ length: 6 }).map((_, col) => (
              <Skeleton key={col} className="h-4 bg-zinc-800" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
