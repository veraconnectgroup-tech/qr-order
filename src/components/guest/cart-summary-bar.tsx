"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAppLocale } from "@/components/guest/app-locale-provider";
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
  const { tUI } = useAppLocale();
  const reduceMotion = useReducedMotion();
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
          initial={reduceMotion ? false : { y: "100%" }}
          animate={{
            y: 0,
            ...(shouldBounce && !reduceMotion ? { y: [0, -6, 0] } : {}),
          }}
          exit={reduceMotion ? undefined : { y: "100%" }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : shouldBounce
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
            aria-label={tUI("a11y.cartSummary", {
              count: itemCount,
              total: formatPrice(total, currency),
            })}
          >
            <span className="text-sm font-medium">
              {itemCount}{" "}
              {itemCount === 1 ? tUI("cart.item") : tUI("cart.items")}
            </span>
            <span className="text-sm font-semibold">{tUI("cart.viewCart")}</span>
            <span className="text-end text-sm font-bold tabular-nums">
              {formatPrice(total, currency)}
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
