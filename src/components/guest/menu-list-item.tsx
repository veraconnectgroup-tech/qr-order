"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import { useCart } from "@/hooks/use-cart";
import { AllergenBadges } from "@/components/guest/allergen-badges";
import { productHasServeSize } from "@/lib/serve-size";
import { cn } from "@/lib/utils";
import type { MenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";
import { GuestProductRow } from "@/components/design-system/guest-product-row";
import { formatPrice } from "@/lib/format";

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

  function handleAdd() {
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
      className={cn(outOfStock && "opacity-50")}
      data-product-id={product.id}
    >
      <GuestProductRow
        name={displayName}
        price={Number(product.price)}
        currency={currency}
        subtitle={displayDescription || null}
        density="menu"
        disabled={cannotOrder}
        addStyle="icon"
        addAriaLabel={`Add ${displayName}`}
        onAdd={handleAdd}
        onOpenDetail={onOpenDetail}
        openDetailAriaLabel={tUI("a11y.productCard", {
          name: displayName,
          price: formatPrice(Number(product.price), currency),
        })}
        meta={
          <>
            {(product.allergens?.length ?? 0) > 0 && (
              <AllergenBadges allergens={product.allergens} className="mt-3" />
            )}
            {outOfStock && (
              <p className="mt-2 text-xs text-[var(--qr-muted)]">
                {tUI("menu.currentlyUnavailable")}
              </p>
            )}
            {orderingDisabled && !outOfStock && (
              <p className="mt-2 text-xs text-[var(--qr-muted)]">
                {tUI("menu.paused")}
              </p>
            )}
          </>
        }
      />
    </article>
  );
}
