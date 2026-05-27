"use client";

import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { DenisTableMark } from "@/components/design-system/denis-table-mark";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  ProductRecommendationCard,
  type ProductRecommendation,
} from "@/components/guest/product-recommendation-card";
import { toastAddedToCart } from "@/lib/cart-toast";

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
  const reduceMotion = useReducedMotion();

  if (!recommendations.length) return null;

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="border-b border-[var(--qr-elevated)] px-3 py-4 sm:px-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--qr-ivory)]">
          <DenisTableMark size={24} state="idle" className="size-4" />
          {tUI("ai.smart.recommendedTitle")}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="flex size-8 items-center justify-center rounded-full text-[var(--qr-muted)] transition hover:bg-[var(--qr-elevated)] hover:text-[var(--qr-ivory)]"
          aria-label={tUI("ai.smart.dismissSection")}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recommendations.map((rec) => (
          <div key={rec.productId} className="w-64 shrink-0 snap-start">
            <ProductRecommendationCard
              recommendation={rec}
              currency={currency}
              orderingDisabled={orderingDisabled}
              onAddClick={() => onAdd(rec)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-3 text-xs text-[var(--qr-muted)] underline-offset-2 hover:text-[var(--qr-ivory)] hover:underline"
      >
        {tUI("ai.smart.reset")}
      </button>
    </motion.section>
  );
}
