"use client";

import Image from "next/image";
import { Clock, Plus } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { AllergenBadges } from "@/components/guest/allergen-badges";
import { productHasServeSize } from "@/lib/serve-size";
import { cn } from "@/lib/utils";
import type { MenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";

export function MenuListItem({
  product,
  currency,
  menuSection = "food",
  onOpenDetail,
  orderingDisabled = false,
}: {
  product: ProductWithModifiers;
  currency: string;
  menuSection?: MenuSection;
  onOpenDetail: () => void;
  orderingDisabled?: boolean;
}) {
  const addItem = useCart((s) => s.addItem);
  const { tName, tDescription, tUI } = useAppLocale();
  const displayName = tName(product);
  const displayDescription = tDescription(product);
  const hasModifiers = (product.modifier_groups?.length ?? 0) > 0;
  const needsConfiguration = hasModifiers || productHasServeSize(product);
  const outOfStock = !product.is_available;
  const cannotOrder = outOfStock || orderingDisabled;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (cannotOrder) return;
    if (needsConfiguration) {
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
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      aria-label={tUI("a11y.productCard", {
        name: displayName,
        price: formatPrice(Number(product.price), currency),
      })}
      className={cn(
        "flex cursor-pointer gap-3 py-4 transition active:opacity-80",
        outOfStock && "opacity-60"
      )}
      data-product-id={product.id}
    >
      {product.image_url ? (
        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[var(--qr-elevated)]">
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="56px"
            className={cn("object-cover", outOfStock && "grayscale")}
          />
        </div>
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-[var(--qr-elevated)] text-lg font-semibold text-[var(--qr-muted)]">
          {displayName.charAt(0)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-[var(--qr-ivory)]">
              {displayName}
            </h3>
            {displayDescription && (
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--qr-muted)]">
                {displayDescription}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--qr-ember)]">
            {formatPrice(Number(product.price), currency)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <AllergenBadges allergens={product.allergens} />
            {product.prep_time_minutes != null && product.prep_time_minutes > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--qr-muted)]">
                <Clock className="size-2.5" />
                {product.prep_time_minutes} min
              </span>
            )}
            {outOfStock && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--qr-muted)]">
                {tUI("menu.currentlyUnavailable")}
              </span>
            )}
          </div>

          {cannotOrder ? (
            orderingDisabled && !outOfStock ? (
              <span className="text-xs text-[var(--qr-muted)]">{tUI("menu.paused")}</span>
            ) : null
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--qr-ember)] text-white transition hover:bg-[var(--qr-ember-hover)] active:scale-95 touch-manipulation"
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
