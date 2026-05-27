"use client";

import { useState } from "react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import type { MenuSection } from "@/lib/menu-section";
import { useCart } from "@/hooks/use-cart";
import { trackAiConversion } from "@/lib/ai/guest-session-storage";
import { GuestProductRow } from "@/components/design-system/guest-product-row";

export type ProductRecommendation = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  reason: string;
};

export function ProductRecommendationCard({
  recommendation,
  currency,
  menuSection = "food",
  productTaxRate = null,
  orderingDisabled = false,
  onOpenDetail,
  className,
  conversionContext,
  compact = false,
  onAddClick,
}: {
  recommendation: ProductRecommendation;
  currency: string;
  menuSection?: MenuSection;
  productTaxRate?: number | null;
  orderingDisabled?: boolean;
  onOpenDetail?: () => void;
  className?: string;
  aiSessionId?: string | null;
  conversionContext?: {
    sessionId: string;
    locationId: string;
    tableId: string;
    sessionToken: string;
  };
  compact?: boolean;
  onAddClick?: () => void;
}) {
  const { tUI } = useAppLocale();
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (orderingDisabled || added) return;

    if (onOpenDetail) {
      onOpenDetail();
      return;
    }

    if (onAddClick) {
      hapticClick();
      onAddClick();
      setAdded(true);
      return;
    }

    hapticClick();
    addItem({
      productId: recommendation.productId,
      productName: recommendation.name,
      unitPrice: recommendation.price,
      quantity: 1,
      notes: "",
      menuSection,
      productTaxRate,
      modifiers: [],
    });
    toastAddedToCart(recommendation.name, recommendation.price, currency);
    setAdded(true);

    if (conversionContext?.sessionId) {
      void trackAiConversion({
        ...conversionContext,
        productId: recommendation.productId,
      });
    }
  }

  return (
    <GuestProductRow
      name={recommendation.name}
      price={recommendation.price}
      currency={currency}
      subtitle={recommendation.reason}
      density={compact ? "compact" : "default"}
      disabled={orderingDisabled}
      added={added}
      addStyle={compact ? "icon" : "text"}
      addLabel={tUI("ai.recommendation.add")}
      addedLabel={tUI("ai.recommendation.added")}
      onAdd={handleAdd}
      className={className}
    />
  );
}
