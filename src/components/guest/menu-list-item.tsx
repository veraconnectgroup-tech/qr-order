"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import { useCart } from "@/hooks/use-cart";
import { AllergenBadges } from "@/components/guest/allergen-badges";
import { productHasServeSize } from "@/lib/serve-size";
import { cn } from "@/lib/utils";
import type { MenuSection } from "@/lib/menu-section";
import type { MenuProductWithGuestTranslation } from "@/hooks/use-translated-menu";
import type { ProductWithModifiers } from "@/types";
import { GuestProductRow } from "@/components/design-system/guest-product-row";
import { MenuPersonalizationBadge } from "@/components/guest/personalized-menu-highlights";
import type { PersonalizedMenuBoost } from "@/lib/denis/intelligence/menu-personalization";
import { formatPrice } from "@/lib/format";

export function MenuListItem({
  product,
  currency,
  menuSection = "food",
  onOpenDetail,
  orderingDisabled = false,
  personalizationBoost = null,
  personalizationRecommendedLabel = null,
  allergenWarning = null,
  simplifiedMenu = false,
}: {
  product: ProductWithModifiers | MenuProductWithGuestTranslation;
  currency: string;
  menuSection?: MenuSection;
  onOpenDetail: () => void;
  orderingDisabled?: boolean;
  personalizationBoost?: PersonalizedMenuBoost;
  personalizationRecommendedLabel?: string | null;
  allergenWarning?: string | null;
  simplifiedMenu?: boolean;
}) {
  const addItem = useCart((s) => s.addItem);
  const { tName, tDescription, tUI } = useAppLocale();
  const guestTranslation = (product as MenuProductWithGuestTranslation)
    .guestTranslation;
  const displayName = guestTranslation ? product.name : tName(product);
  const nameSecondary =
    guestTranslation && guestTranslation.name !== product.name
      ? guestTranslation.name
      : null;
  const displayDescription = guestTranslation
    ? product.description ?? null
    : tDescription(product);
  const descriptionSecondary =
    guestTranslation &&
    guestTranslation.description &&
    guestTranslation.description !== (product.description ?? "")
      ? guestTranslation.description
      : null;
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
      className={cn(outOfStock && "opacity-50", simplifiedMenu && "guest-a11y-simplified-menu-only")}
      data-product-id={product.id}
      aria-label={tUI("a11y.productCard", {
        name: displayName,
        price: formatPrice(Number(product.price), currency),
      })}
    >
      <GuestProductRow
        name={displayName}
        nameSecondary={simplifiedMenu ? null : nameSecondary}
        price={Number(product.price)}
        currency={currency}
        subtitle={simplifiedMenu ? null : displayDescription || null}
        subtitleSecondary={simplifiedMenu ? null : descriptionSecondary}
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
          simplifiedMenu ? (
            outOfStock || orderingDisabled ? (
              <>
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
            ) : null
          ) : (
            <>
              <MenuPersonalizationBadge
                boost={personalizationBoost}
                recommendedLabel={personalizationRecommendedLabel}
              />
              {allergenWarning ? (
                <p className="mt-2 text-xs font-medium text-amber-300/90">
                  {allergenWarning}
                </p>
              ) : null}
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
          )
        }
      />
    </article>
  );
}
