"use client";

import { Printer } from "lucide-react";
import { printKitchenTicket } from "@/lib/kitchen/print-ticket";
import type { OrderWithDetails } from "@/types";
import { cn } from "@/lib/utils";

export function KitchenPrintButton({
  order,
  orgName,
  className,
  label = "Štampaj",
}: {
  order: OrderWithDetails;
  orgName: string;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => printKitchenTicket(order, orgName)}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 touch-manipulation",
        className
      )}
    >
      <Printer className="size-4" />
      {label}
    </button>
  );
}
