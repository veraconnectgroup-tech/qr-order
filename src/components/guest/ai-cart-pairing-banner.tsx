"use client";

import { Plus, X } from "lucide-react";
import { DenisMarkBadge } from "@/components/design-system/denis-mark-badge";
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
      <div className="pointer-events-auto mx-auto max-w-lg overflow-hidden rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)]/95 p-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <DenisMarkBadge size="sm" />
          <p className="min-w-0 flex-1 text-sm text-[var(--qr-ivory)]">
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
                className="flex size-9 items-center justify-center rounded-full bg-[var(--qr-ember)] text-white transition active:scale-95"
                aria-label={tUI("ai.proactive.add", { name: recommendation.name })}
              >
                <Plus className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="flex size-8 items-center justify-center rounded-full text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)]"
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
