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
        <p className="text-heading text-zinc-50">Menu updating</p>
        <p className="mt-2 text-body text-zinc-400">
          Please ask staff for assistance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section
          key={category.id}
          id={`cat-${category.id}`}
          className="scroll-mt-24"
        >
          <h2 className="sticky top-[140px] z-20 -mx-4 mb-4 border-b border-zinc-800/50 bg-zinc-950/80 px-4 py-2 text-heading text-zinc-50 backdrop-blur-lg">
            {category.name}{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({category.products.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
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
