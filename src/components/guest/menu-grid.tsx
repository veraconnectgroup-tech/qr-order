"use client";

import { ProductCard } from "@/components/guest/product-card";
import type { ProductWithModifiers } from "@/types";

export type MenuCategory = {
  id: string;
  name: string;
  products: ProductWithModifiers[];
};

export function MenuGrid({
  categories,
  currency,
  onOpenDetail,
}: {
  categories: MenuCategory[];
  currency: string;
  onOpenDetail: (product: ProductWithModifiers) => void;
}) {
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
            {category.name}{" "}
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
                onOpenDetail={() => onOpenDetail(product)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
