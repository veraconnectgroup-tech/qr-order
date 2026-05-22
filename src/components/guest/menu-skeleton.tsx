export function MenuSkeleton() {
  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-40 bg-[#09090b]/95 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="size-10 animate-pulse rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
            <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800" />
        </div>
      </div>

      <div className="border-b border-zinc-800/50 px-4 py-3">
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800" />
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-full bg-zinc-800"
            />
          ))}
        </div>
      </div>

      <main className="space-y-8 px-4 py-6">
        {[1, 2].map((section) => (
          <div key={section}>
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[10px] bg-zinc-900"
                >
                  <div className="aspect-square animate-pulse bg-zinc-800" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
                    <div className="h-5 w-12 animate-pulse rounded bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
