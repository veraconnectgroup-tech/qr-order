"use client";

import { Plus } from "lucide-react";
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
        "flex cursor-pointer items-start justify-between gap-6 py-5 transition active:opacity-70",
        outOfStock && "opacity-50"
      )}
      data-product-id={product.id}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-[15px] font-medium text-[var(--qr-ivory)]">
            {displayName}
          </h3>
          <span className="shrink-0 text-[15px] tabular-nums text-[var(--qr-ivory)]">
            {formatPrice(Number(product.price), currency)}
          </span>
        </div>
        {displayDescription && (
          <p className="mt-1 max-w-[32rem] text-sm leading-relaxed text-[var(--qr-muted)]">
            {displayDescription}
          </p>
        )}
        {(product.allergens?.length ?? 0) > 0 && (
          <AllergenBadges allergens={product.allergens} className="mt-3" />
        )}
        {outOfStock && (
          <p className="mt-2 text-xs text-[var(--qr-muted)]">
            {tUI("menu.currentlyUnavailable")}
          </p>
        )}
        {orderingDisabled && !outOfStock && (
          <p className="mt-2 text-xs text-[var(--qr-muted)]">{tUI("menu.paused")}</p>
        )}
      </div>

      {!cannotOrder && (
        <button
          type="button"
          onClick={handleAdd}
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)] touch-manipulation"
          aria-label={`Add ${displayName}`}
        >
          <Plus className="size-5" strokeWidth={1.5} />
        </button>
      )}
    </article>
  );
}
