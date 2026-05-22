export function CheckoutSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-zinc-900 p-4">
        <div className="mb-3 h-3 w-32 shimmer rounded bg-zinc-800" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-40 shimmer rounded bg-zinc-800" />
              <div className="h-4 w-16 shimmer rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-11 w-full shimmer rounded-xl bg-zinc-800" />
        <div className="h-11 w-full shimmer rounded-xl bg-zinc-800" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-11 shimmer rounded-xl bg-zinc-800" />
          <div className="h-11 shimmer rounded-xl bg-zinc-800" />
        </div>
      </div>
      <div className="h-14 w-full shimmer rounded-xl bg-zinc-800" />
    </div>
  );
}
