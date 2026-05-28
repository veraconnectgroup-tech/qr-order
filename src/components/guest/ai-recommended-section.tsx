"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
import {
  ProductRecommendationCard,
  type ProductRecommendation,
} from "@/components/guest/product-recommendation-card";

export function AiRecommendedSection({
  recommendations,
  currency,
  orderingDisabled,
  onAdd,
  onDismiss,
  onReset,
}: {
  recommendations: ProductRecommendation[];
  currency: string;
  orderingDisabled?: boolean;
  onAdd: (rec: ProductRecommendation) => void;
  onDismiss: () => void;
  onReset: () => void;
}) {
  const { tUI } = useAppLocale();

  if (!recommendations.length) return null;

  return (
    <section className="px-4 py-6 sm:px-5">
      <div className="mb-4 flex items-center gap-2.5">
        <DenisMarkBadge size="sm" />
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-[var(--qr-ivory)]">
          {tUI("ai.smart.recommendedTitle")}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
        >
          {tUI("ai.smart.dismissSection")}
        </button>
      </div>

      <div className="divide-y divide-[var(--qr-elevated)]/80">
        {recommendations.map((rec) => (
          <ProductRecommendationCard
            key={rec.productId}
            recommendation={rec}
            currency={currency}
            compact
            orderingDisabled={orderingDisabled}
            onAddClick={() => onAdd(rec)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-5 text-xs text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
      >
        {tUI("ai.smart.reset")}
      </button>
    </section>
  );
}
