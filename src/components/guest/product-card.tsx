"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toastAddedToCart } from "@/lib/cart-toast";
import { hapticClick } from "@/lib/haptics";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import type { ProductWithModifiers } from "@/types";

export function ProductCard({
  product,
  currency,
  onOpenDetail,
}: {
  product: ProductWithModifiers;
  currency: string;
  onOpenDetail: () => void;
}) {
  const addItem = useCart((s) => s.addItem);
  const hasModifiers = (product.modifier_groups?.length ?? 0) > 0;

  function handleAdd(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (hasModifiers) {
      onOpenDetail();
      return;
    }
    hapticClick();
    const lineTotal = Number(product.price);
    addItem({
      productId: product.id,
      productName: product.name,
      unitPrice: Number(product.price),
      quantity: 1,
      notes: "",
      modifiers: [],
    });
    toastAddedToCart(product.name, lineTotal, currency);
  }

  return (
    <motion.article
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => handleAdd()}
      className="cursor-pointer overflow-hidden rounded-[10px] bg-zinc-900 shadow-sm active:shadow-none"
    >
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-zinc-600">
            {product.name.charAt(0)}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-zinc-900/80 to-transparent" />
      </div>
      <div className="p-3">
        <h3 className="text-title line-clamp-2 text-zinc-50">{product.name}</h3>
        {product.description && (
          <p className="text-caption mt-1 line-clamp-2 text-zinc-400">
            {product.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-price text-orange-500">
            {formatPrice(Number(product.price), currency)}
          </span>
          <button
            type="button"
            onClick={(e) => handleAdd(e)}
            className="flex size-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm shadow-orange-500/30 transition-transform hover:scale-105 active:scale-95"
            aria-label={`Add ${product.name}`}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
