"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function StaffOrderEntrySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full max-w-xs" />
      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-[520px] rounded-2xl lg:block" />
      </div>
    </div>
  );
}
