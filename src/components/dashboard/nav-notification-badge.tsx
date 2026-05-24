"use client";

import { cn } from "@/lib/utils";

export function NavNotificationBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-dash-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white",
        className
      )}
      aria-label={`${count} notifications`}
    >
      {label}
    </span>
  );
}
