"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export async function setProductAvailability(
  productId: string,
  isAvailable: boolean
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", productId);

  if (error) throw new Error(error.message);
}

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
}: {
  item: OrderItemLine;
  modifiers?: Array<{ id: string; modifier_name: string }>;
  notes?: string | null;
  className?: string;
  nameClassName?: string;
  allowMarkUnavailable?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function markUnavailable() {
    if (!item.product_id || busy) return;
    setBusy(true);
    try {
      await setProductAvailability(item.product_id, false);
      toast.success(`${item.product_name} označen kao nedostupan`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  }

  const line = (
    <>
      {item.quantity}× {item.product_name}
      {modifiers?.map((m) => (
        <span key={m.id} className="ml-4 block text-xs text-zinc-500">
          + {m.modifier_name}
        </span>
      ))}
      {notes && (
        <span className="ml-4 block text-xs italic text-zinc-500">→ {notes}</span>
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
              "text-left transition hover:text-orange-400 disabled:opacity-50",
              nameClassName
            )}
          >
            {line}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="border-zinc-800 bg-zinc-950 text-zinc-100"
        >
          <DropdownMenuItem
            disabled={busy}
            onClick={() => void markUnavailable()}
            className="cursor-pointer text-sm focus:bg-zinc-800"
          >
            Označi kao nedostupno
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
