"use client";

import { motion } from "framer-motion";
import { Plus, Sparkles, X } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import { toastAddedToCart } from "@/lib/cart-toast";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";
import { UtensilsCrossed } from "lucide-react";

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
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="border-b border-zinc-800 px-3 py-4 sm:px-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Sparkles className="size-4 text-orange-400" />
          {tUI("ai.smart.recommendedTitle")}
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label={tUI("ai.smart.dismissSection")}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recommendations.map((rec) => (
          <article
            key={rec.productId}
            className="w-64 shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-orange-500/30 bg-zinc-900"
          >
            <div className="relative h-28 w-full">
              {rec.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rec.imageUrl}
                  alt={rec.name}
                  className="size-full rounded-t-2xl object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <UtensilsCrossed className="size-7 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="space-y-2 p-3">
              <div>
                <p className="truncate text-sm font-semibold text-white">
                  {rec.name}
                </p>
                <p className="text-sm font-bold text-orange-500">
                  {formatPrice(rec.price, currency)}
                </p>
              </div>
              {rec.reason && (
                <p className="text-sm text-orange-300">{rec.reason}</p>
              )}
              {!orderingDisabled && (
                <button
                  type="button"
                  onClick={() => {
                    hapticClick();
                    onAdd(rec);
                    toastAddedToCart(rec.name, rec.price, currency);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 active:scale-[0.98]"
                >
                  <Plus className="size-4" />
                  {tUI("ai.recommendation.add")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-3 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
      >
        {tUI("ai.smart.reset")}
      </button>
    </motion.section>
  );
}
