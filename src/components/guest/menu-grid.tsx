"use client";

import { ProductCard } from "@/components/guest/product-card";
import { useAppLocale } from "@/components/guest/app-locale-provider";
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
  aiReasonByProductId,
}: {
  categories: MenuCategory[];
  unavailableCategories?: MenuCategory[];
  currency: string;
  onOpenDetail: (product: ProductWithModifiers) => void;
  orderingDisabled?: boolean;
  aiReasonByProductId?: Map<string, string>;
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
          className={`scroll-mt-36 ${index > 0 ? "mt-6" : ""}`}
        >
          <h2 className="mb-3 text-lg font-semibold text-zinc-100">
            {tName(category)}{" "}
            <span className="font-normal text-zinc-500">
              ({category.products.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {category.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={currency}
                menuSection={inferMenuSection(category)}
                orderingDisabled={orderingDisabled}
                onOpenDetail={() => onOpenDetail(product)}
                aiReason={aiReasonByProductId?.get(product.id) ?? null}
              />
            ))}
          </div>
        </section>
      ))}

      {unavailableCategories.map((category) => (
        <section
          key={`unavailable-${category.id}`}
          className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 opacity-70"
        >
          <h2 className="text-lg font-semibold text-zinc-500">{tName(category)}</h2>
          {category.scheduleHint && (
            <p className="mt-1 text-sm text-zinc-500">{category.scheduleHint}</p>
          )}
        </section>
      ))}
    </div>
  );
}
