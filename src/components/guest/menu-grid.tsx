"use client";

import { ProductCard } from "@/components/guest/product-card";
import { useMenuLocale } from "@/components/guest/menu-locale-provider";
import { inferMenuSection } from "@/lib/menu-section";
import type { ProductWithModifiers } from "@/types";

export type MenuCategory = {
  id: string;
  name: string;
  name_en?: string | null;
  menu_section?: string | null;
  products: ProductWithModifiers[];
};

export function MenuGrid({
  categories,
  currency,
  onOpenDetail,
  orderingDisabled = false,
}: {
  categories: MenuCategory[];
  currency: string;
  onOpenDetail: (product: ProductWithModifiers) => void;
  orderingDisabled?: boolean;
}) {
  const { tName } = useMenuLocale();
  if (!categories.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-zinc-50">Menu updating</p>
        <p className="mt-2 text-sm text-zinc-400">
          Please ask staff for assistance.
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
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
