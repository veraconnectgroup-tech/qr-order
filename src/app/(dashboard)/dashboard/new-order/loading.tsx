import { Skeleton } from "@/components/ui/skeleton";

export default function NewOrderLoading() {
  return (
    <div className="-m-4 space-y-4 md:-m-6">
      <Skeleton className="h-7 w-32 bg-zinc-800" />
      <Skeleton className="h-11 w-full max-w-xs bg-zinc-800" />
      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <div className="space-y-4">
          <Skeleton className="h-11 w-full bg-zinc-800" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-9 w-20 rounded-full bg-zinc-800"
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton
                key={index}
                className="aspect-[4/3] rounded-xl bg-zinc-800"
              />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-[520px] rounded-2xl bg-zinc-800 lg:block" />
      </div>
    </div>
  );
}
