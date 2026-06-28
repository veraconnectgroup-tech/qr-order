"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function OrderHistoryListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-full max-w-4xl rounded-lg bg-dash-surface-raised" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-dash-surface-raised" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl bg-dash-surface-raised" />
    </div>
  );
}
