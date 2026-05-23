"use client";

import Image from "next/image";
import { Clock, Plus } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { AllergenBadges } from "@/components/guest/allergen-badges";
import { cn } from "@/lib/utils";
import type { MenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";

export function ProductCard({
  product,
  currency,
  menuSection = "food",
  onOpenDetail,
  orderingDisabled = false,
  aiReason,
}: {
  product: ProductWithModifiers;
  currency: string;
  menuSection?: MenuSection;
  onOpenDetail: () => void;
  orderingDisabled?: boolean;
  aiReason?: string | null;
}) {
  const addItem = useCart((s) => s.addItem);
  const { tName, tDescription, tUI } = useAppLocale();
  const displayName = tName(product);
  const displayDescription = tDescription(product);
  const hasModifiers = (product.modifier_groups?.length ?? 0) > 0;
  const outOfStock = !product.is_available;
  const cannotOrder = outOfStock || orderingDisabled;

  function openDetail() {
    onOpenDetail();
  }

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (cannotOrder) return;
    if (hasModifiers) {
      onOpenDetail();
      return;
    }
    hapticClick();
    addItem({
      productId: product.id,
      productName: displayName,
      unitPrice: Number(product.price),
      quantity: 1,
      notes: "",
      menuSection,
      productTaxRate:
        product.tax_rate != null ? Number(product.tax_rate) : null,
      modifiers: [],
    });
    toastAddedToCart(displayName, Number(product.price), currency);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      aria-label={tUI("a11y.productCard", {
        name: displayName,
        price: formatPrice(Number(product.price), currency),
      })}
      className={cn(
        "overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition",
        outOfStock && "bg-zinc-900/60 opacity-70",
        cannotOrder && !outOfStock
          ? "pointer-events-none opacity-40"
          : "cursor-pointer hover:border-zinc-700 active:scale-[0.98]"
      )}
    >
      <div className="relative h-[120px] bg-gradient-to-br from-zinc-800 to-zinc-900 sm:h-[160px]">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={displayName}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className={cn("object-cover", outOfStock && "grayscale")}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-3xl font-bold text-zinc-700">
              {displayName.charAt(0)}
            </span>
          </div>
        )}
        {outOfStock && (
          <span className="absolute start-2 top-2 rounded-full bg-zinc-950/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
            {tUI("menu.currentlyUnavailable")}
          </span>
        )}
        {product.prep_time_minutes != null && product.prep_time_minutes > 0 && (
          <span className="absolute end-2 top-2 flex items-center gap-0.5 rounded-full bg-zinc-950/80 px-1.5 py-0.5 text-[10px] text-zinc-300 backdrop-blur-sm">
            <Clock className="size-2.5" />
            {product.prep_time_minutes} min
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-zinc-100">
          {displayName}
        </h3>
        {displayDescription && (
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
            {displayDescription}
          </p>
        )}
        {aiReason && (
          <p className="mt-1 text-xs italic text-orange-400">{aiReason}</p>
        )}
        <AllergenBadges allergens={product.allergens} className="mt-2" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-orange-500">
            {formatPrice(Number(product.price), currency)}
          </span>
          {cannotOrder ? (
            <span className="text-xs font-medium text-zinc-500">
              {orderingDisabled && !outOfStock
                ? tUI("menu.paused")
                : tUI("menu.currentlyUnavailable")}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 active:scale-95 touch-manipulation sm:size-8"
              aria-label={`Add ${displayName}`}
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
