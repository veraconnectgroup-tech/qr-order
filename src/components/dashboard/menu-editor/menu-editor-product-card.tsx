"use client";

import { Pencil, UtensilsCrossed } from "lucide-react";
import { productGradient } from "@/components/dashboard/menu-editor/types";
import { Switch } from "@/components/ui/switch";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

export function MenuEditorProductCard({
  product,
  currency,
  onToggleAvailable,
  onEdit,
}: {
  product: Product;
  currency: string;
  onToggleAvailable: (available: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-dash-border bg-dash-surface transition hover:border-dash-surface-overlay",
        !product.is_available &&
          "border-dash-surface-overlay bg-dash-surface-raised/80 opacity-80"
      )}
    >
      <div className="relative h-[140px] w-full">
        {!product.is_available && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Unavailable
          </span>
        )}
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br",
              productGradient(product.name)
            )}
          >
            <UtensilsCrossed className="size-8 text-dash-text-disabled" />
          </div>
        )}
      </div>

      <p className="px-4 pt-3 text-sm font-semibold text-white">{product.name}</p>
      {product.description && (
        <p className="mt-0.5 line-clamp-1 px-4 text-xs text-dash-text-disabled">
          {product.description}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between px-4">
        <span className="font-mono text-sm font-semibold text-dash-accent">
          {formatPrice(Number(product.price), currency)}
        </span>
        {product.prep_time_minutes != null && (
          <span className="text-xs text-dash-text-disabled">
            Prep: {product.prep_time_minutes} min
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dash-border px-4 py-3">
        <span className="text-xs font-medium text-dash-text-muted">
          {product.is_available ? "In stock" : "Out of stock"}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            checked={product.is_available}
            onCheckedChange={onToggleAvailable}
            aria-label={
              product.is_available
                ? `Mark ${product.name} as unavailable`
                : `Mark ${product.name} as available`
            }
          />
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-dash-text-muted transition hover:bg-dash-surface-raised hover:text-dash-text"
            aria-label={`Edit ${product.name}`}
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
