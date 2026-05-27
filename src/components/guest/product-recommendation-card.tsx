"use client";

import { useState } from "react";
import { Check, Plus, UtensilsCrossed } from "lucide-react";
import { QrCard } from "@/components/design-system/qr-card";
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
  /** @deprecated Use conversionContext.sessionId — kept for legacy callers */
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

  if (compact) {
    return (
      <QrCard
        padding="sm"
        className={cn("border-[var(--qr-elevated)] bg-[var(--qr-surface)]", className)}
      >
        <div className="flex items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--qr-elevated)]">
            {recommendation.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recommendation.imageUrl}
                alt={recommendation.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <UtensilsCrossed className="size-4 text-[var(--qr-muted)]" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--qr-ivory)]">
              {recommendation.name}
            </p>
            {recommendation.reason && (
              <p className="line-clamp-1 text-xs text-[var(--qr-muted)]">
                {recommendation.reason}
              </p>
            )}
            <p className="mt-0.5 text-xs font-bold text-[var(--qr-ember)]">
              {formatPrice(recommendation.price, currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={orderingDisabled || added}
            aria-label={recommendation.name}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95",
              added
                ? "bg-[var(--qr-elevated)] text-[var(--qr-muted)]"
                : "bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)] disabled:opacity-50"
            )}
          >
            {added ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        </div>
      </QrCard>
    );
  }

  return (
    <QrCard
      padding="none"
      className={cn("overflow-hidden border-[var(--qr-elevated)] bg-[var(--qr-surface)]", className)}
    >
      <div className="relative h-32 w-full bg-[var(--qr-elevated)]">
        {recommendation.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recommendation.imageUrl}
            alt={recommendation.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <UtensilsCrossed className="size-8 text-[var(--qr-muted)]" />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--qr-ivory)]">
            {recommendation.name}
          </h3>
          <p className="mt-1 font-bold text-[var(--qr-ember)]">
            {formatPrice(recommendation.price, currency)}
          </p>
        </div>

        {recommendation.reason && (
          <p className="text-sm text-[var(--qr-muted)]">{recommendation.reason}</p>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={orderingDisabled || added}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98]",
            added
              ? "cursor-default bg-[var(--qr-elevated)] text-[var(--qr-muted)]"
              : "bg-[var(--qr-ember)] text-white hover:bg-[var(--qr-ember-hover)] disabled:opacity-50"
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
    </QrCard>
  );
}
