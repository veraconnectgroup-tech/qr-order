"use client";

import { useState } from "react";
import { Check, UtensilsCrossed } from "lucide-react";
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
}: {
  recommendation: ProductRecommendation;
  currency: string;
  menuSection?: MenuSection;
  productTaxRate?: number | null;
  orderingDisabled?: boolean;
  onOpenDetail?: () => void;
  className?: string;
  /** @deprecated Use conversionContext.sessionId — kept for legacy callers */
  aiSessionId?: string | null;
  conversionContext?: {
    sessionId: string;
    locationId: string;
    tableId: string;
    sessionToken: string;
  };
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
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900",
        className
      )}
    >
      <div className="relative h-32 w-full">
        {recommendation.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recommendation.imageUrl}
            alt={recommendation.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <UtensilsCrossed className="size-8 text-zinc-600" />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {recommendation.name}
          </h3>
          <p className="mt-1 text-orange-500 font-bold">
            {formatPrice(recommendation.price, currency)}
          </p>
        </div>

        {recommendation.reason && (
          <p className="text-sm text-zinc-400">{recommendation.reason}</p>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={orderingDisabled || added}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98]",
            added
              ? "cursor-default bg-zinc-700 text-zinc-300"
              : "bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          )}
        >
          {added ? (
            <>
              <Check className="size-4" />
              {tUI("ai.recommendation.added")}
            </>
          ) : (
            tUI("ai.recommendation.add")
          )}
        </button>
      </div>
    </article>
  );
}
