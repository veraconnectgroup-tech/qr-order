"use client";

import { Lock } from "lucide-react";
import { CheckoutTrustBadges } from "@/components/guest/checkout-trust-badges";
import {
  DEMO_CART_ITEMS,
  DEMO_CURRENCY,
  DEMO_TAX_PERCENT,
} from "@/components/landing/demo-data";
import { ShowcasePhone } from "@/components/landing/showcase-frame";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function CheckoutShowcase() {
  const subtotal = DEMO_CART_ITEMS.reduce((sum, item) => sum + item.itemTotal, 0);
  const taxAmount = subtotal * (DEMO_TAX_PERCENT / 100);
  const total = subtotal + taxAmount;

  return (
    <ShowcasePhone label="Guest phone — checkout" shortLabel="Guest — pay">
      <div className="pointer-events-none min-h-[min(520px,72dvh)] select-none bg-[#09090b] p-3 sm:min-h-[560px] sm:p-4">
        <p className="text-sm font-semibold text-zinc-50">Checkout</p>
        <p className="text-xs text-zinc-500">Table 8 · Skyline Lounge</p>

        <div className="mt-3 rounded-xl bg-zinc-900 p-3 sm:mt-4 sm:p-4">
          <h2 className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500 sm:mb-3 sm:text-xs">
            Order summary
          </h2>
          {DEMO_CART_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex justify-between gap-2 py-1 text-xs text-zinc-300 sm:text-sm"
            >
              <span className="min-w-0 truncate">
                {item.quantity}× {item.productName}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPrice(item.itemTotal, DEMO_CURRENCY)}
              </span>
            </div>
          ))}
          <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 text-xs sm:mt-3 sm:pt-3 sm:text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, DEMO_CURRENCY)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Tax ({DEMO_TAX_PERCENT}%)</span>
              <span>{formatPrice(taxAmount, DEMO_CURRENCY)}</span>
            </div>
            <div className="flex justify-between font-semibold text-zinc-50">
              <span>Total</span>
              <span className="text-orange-500">
                {formatPrice(total, DEMO_CURRENCY)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex h-10 items-center justify-center rounded-lg bg-black text-white sm:mt-4 sm:h-11">
          <span className="text-xs font-semibold sm:text-sm"> Apple Pay</span>
        </div>

        <div className="my-2.5 flex items-center gap-2 sm:my-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[9px] text-zinc-600 sm:text-[10px]">or pay with card</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <div className="flex h-9 items-center rounded-md border border-zinc-800 bg-zinc-900 px-3 text-[10px] tracking-widest text-zinc-400 sm:h-10 sm:text-xs">
          4242 ···· ···· 4242
        </div>

        <Button
          type="button"
          className="mt-3 h-10 w-full bg-orange-500 text-sm hover:bg-orange-600 sm:mt-4 sm:h-11"
        >
          Pay {formatPrice(total, DEMO_CURRENCY)}
        </Button>

        <p className="mt-2 flex items-center justify-center gap-1 text-[9px] text-zinc-600 sm:mt-3 sm:text-[10px]">
          <Lock className="size-3" />
          Secure payment via Stripe
        </p>

        <div className="mt-3 scale-[0.92] sm:mt-4 sm:scale-90">
          <CheckoutTrustBadges />
        </div>
      </div>
    </ShowcasePhone>
  );
}
