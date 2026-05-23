"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";

export function CartSummaryBar({
  slug,
  token,
  taxPercent,
  currency,
  glowOnMount = false,
}: {
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
  glowOnMount?: boolean;
}) {
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.total(false, taxPercent));
  const itemCount = useCart((s) => s.itemCount());
  const cartBump = useCart((s) => s.cartBump);
  const prevCount = useRef(itemCount);

  useEffect(() => {
    prevCount.current = itemCount;
  }, [itemCount]);

  const shouldBounce = cartBump > 0;

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{
            y: 0,
            ...(shouldBounce ? { y: [0, -6, 0] } : {}),
          }}
          exit={{ y: "100%" }}
          transition={
            shouldBounce
              ? { y: { duration: 0.3 } }
              : { type: "spring", damping: 28, stiffness: 320 }
          }
          className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-orange-500 px-4 pt-3 pb-safe text-white shadow-2xl touch-manipulation ${
            glowOnMount ? "shadow-orange-500/40" : ""
          }`}
        >
          <Link
            href={`/${slug}/${token}/cart`}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1"
          >
            <span className="text-sm font-medium">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="text-sm font-semibold">View cart</span>
            <span className="text-right text-sm font-bold tabular-nums">
              {formatPrice(total, currency)}
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
