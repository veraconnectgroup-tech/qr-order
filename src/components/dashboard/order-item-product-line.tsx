"use client";

import { useState } from "react";
import { toast } from "sonner";
import { patchProductAvailabilityClient } from "@/lib/products/eighty-six-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type OrderItemLine = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
};

export function OrderItemProductLine({
  item,
  modifiers,
  notes,
  className,
  nameClassName,
  allowMarkUnavailable = true,
  onEightySix,
}: {
  item: OrderItemLine;
  modifiers?: Array<{ id: string; modifier_name: string }>;
  notes?: string | null;
  className?: string;
  nameClassName?: string;
  allowMarkUnavailable?: boolean;
  onEightySix?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function markUnavailable() {
    if (!item.product_id || busy) return;
    setBusy(true);
    try {
      await patchProductAvailabilityClient(item.product_id, false);
      toast.success(`${item.product_name} označeno kao nedostupno`);
      onEightySix?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const line = (
    <>
      {item.quantity}× {item.product_name}
      {modifiers?.map((m) => (
        <span key={m.id} className="ml-4 block text-xs text-dash-text-disabled">
          + {m.modifier_name}
        </span>
      ))}
      {notes && (
        <span className="ml-4 block text-xs italic text-dash-text-disabled">→ {notes}</span>
      )}
    </>
  );

  if (!allowMarkUnavailable || !item.product_id) {
    return <li className={className}>{line}</li>;
  }

  return (
    <li className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className={cn(
              "text-left transition hover:text-dash-accent disabled:opacity-50",
              nameClassName
            )}
          >
            {line}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="border-dash-border bg-dash-bg text-dash-text"
        >
          <DropdownMenuItem
            disabled={busy}
            onClick={() => void markUnavailable()}
            className="cursor-pointer text-sm focus:bg-dash-surface-raised"
          >
            Nema više (86)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
