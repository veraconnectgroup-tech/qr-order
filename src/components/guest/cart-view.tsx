"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { QuantitySelector } from "@/components/guest/quantity-selector";
import { Button } from "@/components/ui/button";

export function CartView({
  slug,
  token,
  orgName,
  tableName,
  taxPercent,
  currency,
  orderingEnabled = true,
}: {
  slug: string;
  token: string;
  orgName: string;
  tableName: string;
  taxPercent: number;
  currency: string;
  orderingEnabled?: boolean;
}) {
  const items = useCart((s) => s.items);
  const removeItem = useCart((s) => s.removeItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const subtotal = useCart((s) => s.subtotal());
  const taxAmount = useCart((s) => s.taxAmount(taxPercent));
  const total = useCart((s) => s.total(taxPercent));

  if (!items.length) {
    return (
      <div className="min-h-screen px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Link href={`/${slug}/${token}`} className="text-zinc-400">
            ← Back
          </Link>
          <h1 className="text-heading text-zinc-50">Your order</h1>
        </header>
        <div className="py-20 text-center">
          <p className="text-heading text-zinc-50">Your cart is empty</p>
          <p className="mt-2 text-body text-zinc-400">
            Browse the menu and add something delicious
          </p>
          <Button asChild className="mt-6 bg-orange-500 hover:bg-orange-600">
            <Link href={`/${slug}/${token}`}>View menu</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <Link href={`/${slug}/${token}`} className="text-zinc-400">
          ← Back
        </Link>
        <h1 className="text-heading text-zinc-50">Your order</h1>
      </header>

      <p className="text-caption mb-6 text-zinc-500">
        {tableName} · {orgName}
      </p>

      {!orderingEnabled && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Ordering is paused right now. You can review your cart, but checkout is
          unavailable until staff reopens ordering.
        </div>
      )}

      <motion.div
        className="space-y-3"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {items.map((item, index) => (
          <motion.div
            key={`${item.productId}-${index}`}
            layout
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0 },
            }}
            className="rounded-xl bg-zinc-900 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-title text-zinc-50">{item.productName}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-caption mt-1 text-zinc-400">
                    {item.modifiers.map((m) => m.modifierName).join(", ")}
                  </p>
                )}
                {item.notes && (
                  <p className="text-caption mt-1 italic text-zinc-500">
                    {item.notes}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-zinc-500 hover:text-red-400"
                aria-label="Remove item"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <QuantitySelector
                value={item.quantity}
                onChange={(q) => updateQuantity(index, q)}
              />
              <span className="text-price text-zinc-50">
                {formatPrice(item.itemTotal, currency)}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <Link
        href={`/${slug}/${token}`}
        className="mt-4 block rounded-xl border border-dashed border-zinc-700 p-4 text-center text-sm text-orange-500"
      >
        + Add more items
      </Link>

      <div className="mt-6 rounded-xl bg-zinc-900 p-4">
        <div className="flex justify-between text-sm text-zinc-400">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm text-zinc-400">
          <span>Tax ({taxPercent}%)</span>
          <span className="tabular-nums">{formatPrice(taxAmount, currency)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3">
          <span className="font-semibold text-zinc-50">Total</span>
          <span className="text-lg font-bold tabular-nums text-zinc-50">
            {formatPrice(total, currency)}
          </span>
        </div>
      </div>

      {orderingEnabled ? (
        <Button
          asChild
          className="mt-6 h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600"
        >
          <Link href={`/${slug}/${token}/checkout`}>Continue to payment →</Link>
        </Button>
      ) : (
        <Button
          disabled
          className="mt-6 h-14 w-full rounded-xl text-base font-bold"
        >
          Checkout unavailable
        </Button>
      )}
    </div>
  );
}
