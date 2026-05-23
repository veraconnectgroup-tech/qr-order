import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="bg-neutral-50 p-6">
      <Skeleton className="mb-6 h-8 w-48 bg-neutral-200" />

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <Skeleton className="h-4 w-20 bg-neutral-200" />
            <Skeleton className="mt-3 h-8 w-16 bg-neutral-200" />
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg bg-neutral-200" />
        <Skeleton className="h-64 w-full rounded-lg bg-neutral-200" />
      </div>
    </div>
  );
}
