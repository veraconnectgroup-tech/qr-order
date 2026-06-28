"use client";

import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { PersonalizationMeta } from "@/lib/denis/intelligence/menu-personalization";
import {
  personalizationBoostLabel,
  type PersonalizedMenuBoost,
} from "@/lib/denis/intelligence/menu-personalization";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PersonalizationStrip({
  meta,
  onSelectProduct,
  className,
}: {
  meta: PersonalizationMeta;
  onSelectProduct?: (productId: string) => void;
  className?: string;
}) {
  if (meta.strip.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      aria-label="Personalized menu highlights"
    >
      {meta.strip.map((chip) => (
        <button
          key={`${chip.kind}:${chip.productId}`}
          type="button"
          onClick={() => onSelectProduct?.(chip.productId)}
          className="shrink-0 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-left text-xs font-medium text-orange-100 transition-colors hover:bg-orange-500/15"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function PersonalizedMenuHighlights({
  meta,
  showHiddenAllergens,
  onToggleHiddenAllergens,
  onSelectProduct,
}: {
  meta: PersonalizationMeta;
  showHiddenAllergens: boolean;
  onToggleHiddenAllergens: () => void;
  onSelectProduct?: (productId: string) => void;
}) {
  const { tUI } = useAppLocale();

  const hasStrips =
    meta.strip.length > 0 ||
    meta.hiddenAllergenCount > 0;

  if (!hasStrips) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      <PersonalizationStrip meta={meta} onSelectProduct={onSelectProduct} />

      {meta.hiddenAllergenCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p>
            {tUI("menu.personalization.hiddenAllergens", {
              count: meta.hiddenAllergenCount,
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-500/30 bg-transparent text-amber-100 hover:bg-amber-500/10"
            onClick={onToggleHiddenAllergens}
          >
            {showHiddenAllergens
              ? tUI("menu.personalization.hideAllergens")
              : tUI("menu.personalization.showAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function MenuPersonalizationBadge({
  boost,
  recommendedLabel,
}: {
  boost: PersonalizedMenuBoost;
  recommendedLabel?: string | null;
}) {
  const { menuLocale } = useAppLocale();

  const label =
    recommendedLabel ??
    (boost ? personalizationBoostLabel(boost, menuLocale) : null);

  if (!label) return null;

  return (
    <p className="mt-2 text-xs font-medium text-orange-300/90">{label}</p>
  );
}
