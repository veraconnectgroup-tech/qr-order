"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { CheckoutSkeleton } from "@/components/guest/checkout-skeleton";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { orderPlacedMessage } from "@/lib/menu-section";
import type { MenuSection } from "@/lib/menu-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function saveGuestEmail(sessionToken: string, guestEmail: string) {
  if (!guestEmail) return;
  await fetch("/api/sessions/guest-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, guestEmail }),
  });
}

function OrderSummary({
  items,
  subtotal,
  taxPercent,
  taxAmount,
  total,
  currency,
}: {
  items: CartItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  currency: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <h2 className="text-caption mb-3 uppercase tracking-wide text-zinc-500">
        Order summary
      </h2>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between py-1 text-sm text-zinc-300">
          <span>
            {item.quantity}× {item.productName}
          </span>
          <span className="tabular-nums">{formatPrice(item.itemTotal, currency)}</span>
        </div>
      ))}
      <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Tax ({taxPercent}%)</span>
          <span>{formatPrice(taxAmount, currency)}</span>
        </div>
        <div className="flex justify-between font-bold text-zinc-50">
          <span>Total</span>
          <span>{formatPrice(total, currency)}</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        You&apos;ll choose how to pay on the order screen after the kitchen
        receives your order.
      </p>
    </div>
  );
}

export function CheckoutForm({
  slug,
  token,
  taxPercent,
  currency,
}: {
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
}) {
  const items = useCart((s) => s.items);
  const sessionToken = useCart((s) => s.sessionToken);
  const subtotal = useCart((s) => s.subtotal());
  const taxAmount = useCart((s) => s.taxAmount(taxPercent));
  const total = useCart((s) => s.total(taxPercent));
  const clearCart = useCart((s) => s.clearCart);
  const router = useRouter();
  const orderPlacedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");

  useEffect(() => {
    if (orderPlacedRef.current) return;
    if (!items.length || !sessionToken) {
      router.replace(`/${slug}/${token}/cart`);
      return;
    }
    setReady(true);
  }, [items.length, sessionToken, slug, token, router]);

  async function handlePlaceOrder() {
    if (!sessionToken) return;
    setProcessing(true);
    setError(null);

    try {
      await saveGuestEmail(sessionToken, guestEmail);

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          tableToken: token,
          items,
          guestEmail: guestEmail || undefined,
          paymentMethod: "unset",
        }),
      });

      const parsed = await readJsonResponse<{
        error?: string;
        details?: unknown;
        data?: { orderId: string };
      }>(res);

      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      const json = parsed.data;
      if (!res.ok || !json.data?.orderId) {
        throw new Error(json.error ?? "Order could not be placed.");
      }

      orderPlacedRef.current = true;
      hapticSuccess();
      toast.success(
        orderPlacedMessage(
          items.map((item) => item.menuSection ?? ("food" as MenuSection))
        )
      );
      router.replace(`/${slug}/${token}/order/${json.data.orderId}`);
      clearCart();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setProcessing(false);
    }
  }

  if (!ready) {
    return (
      <div className="py-6">
        <CheckoutSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrderSummary
        items={items}
        subtotal={subtotal}
        taxPercent={taxPercent}
        taxAmount={taxAmount}
        total={total}
        currency={currency}
      />

      <div>
        <Label htmlFor="checkout-email" className="text-zinc-400">
          Email (optional, for receipt)
        </Label>
        <Input
          id="checkout-email"
          type="email"
          placeholder="you@example.com"
          className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <Button
        type="button"
        disabled={processing}
        onClick={handlePlaceOrder}
        className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600"
      >
        {processing ? "Placing order…" : "Place order"}
      </Button>
    </div>
  );
}
