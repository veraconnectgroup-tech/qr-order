export function MenuSkeleton() {
  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-10 animate-pulse rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800" />
        </div>
      </div>

      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="h-10 animate-pulse rounded-full bg-zinc-800" />
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-zinc-800"
            />
          ))}
        </div>
      </div>

      <main className="space-y-6 px-4 py-6">
        {[1, 2].map((section) => (
          <div key={section}>
            <div className="mb-3 h-6 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                >
                  <div className="h-[120px] animate-pulse bg-zinc-800 sm:h-[160px]" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
                    <div className="flex justify-between pt-1">
                      <div className="h-4 w-12 animate-pulse rounded bg-zinc-800" />
                      <div className="size-8 animate-pulse rounded-full bg-zinc-800" />
                    </div>
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
