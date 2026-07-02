"use client";

import { Lock, Shield } from "lucide-react";
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
    <ShowcasePhone label="Guest phone - checkout" shortLabel="Guest - pay">
      <div className="pointer-events-none min-h-[min(520px,72dvh)] select-none bg-[#fbfcfd] p-3 sm:min-h-[560px] sm:p-4">
        <p className="text-sm font-semibold text-[#1f2328]">Checkout</p>
        <p className="text-xs text-[#6b7280]">Table 8 · Skyline Lounge</p>

        <div className="mt-3 rounded-xl border border-[#e7ebf0] bg-white p-3 sm:mt-4 sm:p-4">
          <h2 className="mb-2 text-[10px] uppercase tracking-normal text-[#6b7280] sm:mb-3 sm:text-xs">
            Order summary
          </h2>
          {DEMO_CART_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex justify-between gap-2 py-1 text-xs text-[#1f2328] sm:text-sm"
            >
              <span className="min-w-0 truncate">
                {item.quantity}× {item.productName}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPrice(item.itemTotal, DEMO_CURRENCY)}
              </span>
            </div>
          ))}
          <div className="mt-2 space-y-1 border-t border-[#edf1f5] pt-2 text-xs sm:mt-3 sm:pt-3 sm:text-sm">
            <div className="flex justify-between text-[#6b7280]">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, DEMO_CURRENCY)}</span>
            </div>
            <div className="flex justify-between text-[#6b7280]">
              <span>Tax ({DEMO_TAX_PERCENT}%)</span>
              <span>{formatPrice(taxAmount, DEMO_CURRENCY)}</span>
            </div>
            <div className="flex justify-between font-semibold text-[#1f2328]">
              <span>Total</span>
              <span>
                {formatPrice(total, DEMO_CURRENCY)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex h-10 items-center justify-center rounded-lg bg-black text-white sm:mt-4 sm:h-11">
          <span className="text-xs font-semibold sm:text-sm"> Apple Pay</span>
        </div>

        <div className="my-2.5 flex items-center gap-2 sm:my-3">
          <div className="h-px flex-1 bg-[#e7ebf0]" />
          <span className="text-[9px] text-[#6b7280] sm:text-[10px]">or pay with card</span>
          <div className="h-px flex-1 bg-[#e7ebf0]" />
        </div>

        <div className="flex h-9 items-center rounded-md border border-[#e7ebf0] bg-white px-3 text-[10px] tracking-normal text-[#6b7280] sm:h-10 sm:text-xs">
          4242 ···· ···· 4242
        </div>

        <Button
          type="button"
          className="mt-3 h-10 w-full rounded-xl bg-[#1f2328] text-sm font-semibold text-white hover:bg-[#111317] sm:mt-4 sm:h-11"
        >
          Pay {formatPrice(total, DEMO_CURRENCY)}
        </Button>

        <p className="mt-2 flex items-center justify-center gap-1 text-[9px] text-[#6b7280] sm:mt-3 sm:text-[10px]">
          <Lock className="size-3" />
          Secure payment via Stripe
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[10px] text-[#6b7280] sm:mt-4 sm:text-xs">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" />
            256-bit SSL
          </span>
          <span className="font-semibold text-[#635BFF]">stripe</span>
          <span className="flex items-center gap-1.5">
            <Shield className="size-3.5" />
            PCI DSS compliant
          </span>
        </div>
      </div>
    </ShowcasePhone>
  );
}
