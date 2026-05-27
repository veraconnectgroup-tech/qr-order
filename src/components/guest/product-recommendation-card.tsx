"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { toastAddedToCart } from "@/lib/cart-toast";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";
import type { MenuSection } from "@/lib/menu-section";
import { useCart } from "@/hooks/use-cart";
import { trackAiConversion } from "@/lib/ai/guest-session-storage";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-3",
        compact && "py-2.5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[15px] font-medium text-[var(--qr-ivory)]">
            {recommendation.name}
          </p>
          <span className="shrink-0 text-sm tabular-nums text-[var(--qr-ivory)]">
            {formatPrice(recommendation.price, currency)}
          </span>
        </div>
        {recommendation.reason && (
          <p className="mt-1 text-sm text-[var(--qr-muted)]">{recommendation.reason}</p>
        )}
      </div>
      {!orderingDisabled && !added && (
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 text-xs text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
        >
          {compact ? <Plus className="size-4" strokeWidth={1.5} /> : tUI("ai.recommendation.add")}
        </button>
      )}
      {added && (
        <span className="shrink-0 text-xs text-[var(--qr-muted)]">
          {tUI("ai.recommendation.added")}
        </span>
      )}
    </div>
  );
}
