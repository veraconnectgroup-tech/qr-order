"use client";

import { Plus, X } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { ProductRecommendation } from "@/components/guest/product-recommendation-card";
import { formatPrice } from "@/lib/format";
import { hapticClick } from "@/lib/haptics";

export function AiCartPairingBanner({
  recommendation,
  currency,
  orderingDisabled,
  onAdd,
  onDismiss,
}: {
  recommendation: ProductRecommendation;
  currency: string;
  orderingDisabled?: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const { tUI } = useAppLocale();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-3">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 p-3">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-zinc-100">
            {tUI("ai.proactive.pairing", {
              name: recommendation.name,
              price: formatPrice(recommendation.price, currency),
            })}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {!orderingDisabled && (
              <button
                type="button"
                onClick={() => {
                  hapticClick();
                  onAdd();
                }}
                className="flex size-9 items-center justify-center rounded-full bg-orange-500 text-white transition hover:bg-orange-600 active:scale-95"
                aria-label={tUI("ai.proactive.add", { name: recommendation.name })}
              >
                <Plus className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-300"
              aria-label={tUI("ai.proactive.dismiss")}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
