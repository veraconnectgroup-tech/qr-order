"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShoppingBag } from "lucide-react";
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
  const total = useCart((s) => s.total(taxPercent));
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
          initial={{ y: 100, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            ...(shouldBounce ? { y: [0, -8, 0] } : {}),
          }}
          exit={{ y: 100, opacity: 0 }}
          transition={
            shouldBounce
              ? { y: { duration: 0.3 } }
              : { type: "spring", damping: 30, stiffness: 300 }
          }
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
        >
          <Link
            href={`/${slug}/${token}/cart`}
            className={`flex h-16 items-center justify-between rounded-t-2xl bg-orange-500 px-5 text-white shadow-lg ${
              glowOnMount ? "animate-pulse shadow-orange-500/40" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="size-5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={itemCount}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="inline-block"
                    >
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </motion.span>
                  </AnimatePresence>
                </p>
                <p className="text-xs text-orange-100">View cart</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums">
                {formatPrice(total, currency)}
              </span>
              <ArrowRight className="size-5" />
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
