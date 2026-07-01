"use client";

import { MenuListItem } from "@/components/guest/menu-list-item";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { MenuPersonalizationBadge } from "@/components/guest/personalized-menu-highlights";
import type { PersonalizedMenuBoost } from "@/lib/denis/intelligence/menu-personalization";
import { inferMenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";

export type MenuCategory = {
  id: string;
  name: string;
  name_en?: string | null;
  menu_section?: string | null;
  products: ProductWithModifiers[];
  schedule_enabled?: boolean;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_days?: number[] | null;
  scheduleHint?: string | null;
  isScheduleAvailable?: boolean;
};

export function MenuGrid({
  categories,
  unavailableCategories = [],
  currency,
  onOpenDetail,
  orderingDisabled = false,
  simplifiedMenu = false,
  personalizationByProductId,
}: {
  categories: MenuCategory[];
  unavailableCategories?: MenuCategory[];
  currency: string;
  onOpenDetail: (product: ProductWithModifiers) => void;
  orderingDisabled?: boolean;
  simplifiedMenu?: boolean;
  aiReasonByProductId?: Map<string, string>;
  personalizationByProductId?: Map<
    string,
    {
      boost: PersonalizedMenuBoost;
      allergenWarning: string | null;
      recommendedLabel: string | null;
    }
  >;
}) {
  const { tName, tUI } = useAppLocale();
  if (!categories.length && !unavailableCategories.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-zinc-50">
          {tUI("menu.updating")}
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          {tUI("menu.updatingHint")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {categories.map((category, index) => (
        <section
          key={category.id}
          id={`cat-${category.id}`}
          className={`scroll-mt-36 ${index > 0 ? "mt-12" : ""}`}
        >
          <h2 className="mb-1 text-lg font-semibold text-[var(--qr-ivory)]">
            {tName(category)}{" "}
            <span className="font-normal text-[var(--qr-muted)]">
              ({category.products.length})
            </span>
          </h2>
          <div className="divide-y divide-[var(--qr-elevated)]/80">
            {category.products.map((product) => {
              const personalization = personalizationByProductId?.get(product.id);
              return (
                <MenuListItem
                  key={product.id}
                  product={product}
                  currency={currency}
                  menuSection={inferMenuSection(category)}
                  orderingDisabled={orderingDisabled}
                  simplifiedMenu={simplifiedMenu}
                  onOpenDetail={() => onOpenDetail(product)}
                  personalizationBoost={personalization?.boost ?? null}
                  personalizationRecommendedLabel={
                    personalization?.recommendedLabel ?? null
                  }
                  allergenWarning={personalization?.allergenWarning ?? null}
                />
              );
            })}
          </div>
        </section>
      ))}

      {unavailableCategories.map((category) => (
        <section
          key={`unavailable-${category.id}`}
          className="mt-8 rounded-xl border border-[var(--qr-elevated)] bg-[var(--qr-surface)]/40 p-4 opacity-70"
        >
          <h2 className="text-lg font-semibold text-[var(--qr-muted)]">
            {tName(category)}
          </h2>
          {category.scheduleHint && (
            <p className="mt-1 text-sm text-[var(--qr-muted)]">
              {category.scheduleHint}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
