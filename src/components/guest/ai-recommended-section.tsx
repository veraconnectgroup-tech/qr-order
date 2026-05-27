"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
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
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-[var(--qr-ivory)]">
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
