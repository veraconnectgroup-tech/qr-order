"use client";

import { Store } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { cn } from "@/lib/utils";

type BillOrderSourceBadgeProps = {
  orderSource: string;
  className?: string;
};

export function BillOrderSourceBadge({
  orderSource,
  className,
}: BillOrderSourceBadgeProps) {
  const { tUI } = useAppLocale();

  if (orderSource !== "pos") return null;

  return (
    <span
      className={cn(
        "inline-flex min-h-[22px] items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300",
        className
      )}
      aria-label={tUI("bill.posBadge")}
    >
      <Store className="size-3 shrink-0" aria-hidden />
      {tUI("bill.posBadge")}
    </span>
  );
}

export function isPosOrderSource(orderSource: string): boolean {
  return orderSource === "pos";
}
