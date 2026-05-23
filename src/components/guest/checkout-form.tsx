"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { hapticSuccess } from "@/lib/haptics";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { useGuestSessionToken } from "@/hooks/use-guest-session-token";
import { formatPrice } from "@/lib/format";
import { CheckoutSkeleton } from "@/components/guest/checkout-skeleton";
import { UpsellBar } from "@/components/guest/upsell-bar";
import {
  PromoInput,
  type AppliedPromo,
} from "@/components/guest/promo-input";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { fetchWithRetry, isServerErrorStatus } from "@/lib/payment/fetch-with-retry";
import { recordGuestOrderPlaced } from "@/lib/pwa/install-timing";
import {
  enqueueOfflineOrder,
  registerOrderSync,
} from "@/lib/pwa/offline-order-queue";
import type { TaxBreakdownLine } from "@/lib/tax/vat";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

async function saveGuestEmail(sessionToken: string, guestEmail: string) {
  if (!guestEmail.trim()) return;
  const res = await fetch("/api/sessions/guest-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, guestEmail: guestEmail.trim() }),
  });
  if (!res.ok) {
    throw new Error("Could not save email.");
  }
}

function OrderSummary({
  items,
  subtotal,
  taxBreakdown,
  taxAmount,
  total,
  discountAmount,
  currency,
  tUI,
}: {
  items: CartItem[];
  subtotal: number;
  taxBreakdown: TaxBreakdownLine[];
  taxAmount: number;
  total: number;
  discountAmount: number;
  currency: string;
  tUI: ReturnType<typeof useAppLocale>["tUI"];
}) {
  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <h2 className="text-caption mb-3 uppercase tracking-wide text-zinc-500">
        {tUI("checkout.orderSummary")}
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
          <span>{tUI("checkout.subtotal")}</span>
          <span>{formatPrice(subtotal, currency)}</span>
        </div>
        {taxBreakdown.length > 0 ? (
          taxBreakdown.map((line) => (
            <div
              key={line.rate}
              className="flex justify-between text-zinc-400 tabular-nums"
            >
              <span data-testid="checkout-tax-line">
                {tUI("checkout.tax", { rate: line.rate })}
              </span>
              <span>{formatPrice(line.amount, currency)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-zinc-400">
            <span data-testid="checkout-tax-line">{tUI("checkout.taxGeneric")}</span>
            <span>{formatPrice(taxAmount, currency)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-400">
            <span>{tUI("checkout.discount")}</span>
            <span className="tabular-nums">
              -{formatPrice(discountAmount, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-bold text-zinc-50">
          <span>{tUI("checkout.total")}</span>
          <span className="tabular-nums">{formatPrice(total, currency)}</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        {tUI("checkout.paymentLater")}
      </p>
    </div>
  );
}

export function CheckoutForm({
  slug,
  token,
  locationId,
  taxPercent,
  currency,
  isDemo = false,
}: {
  slug: string;
  token: string;
  locationId: string;
  taxPercent: number;
  currency: string;
  isDemo?: boolean;
}) {
  const { tUI } = useAppLocale();
  const items = useCart((s) => s.items);
  const { sessionToken, hydrated: sessionHydrated } = useGuestSessionToken();
  const subtotal = useCart((s) => s.subtotal());
  const taxBreakdown = useCart((s) => s.taxBreakdown);
  const taxAmount = useCart((s) => s.taxAmount);
  const total = useCart((s) => s.total);
  const clearCart = useCart((s) => s.clearCart);
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const orderPlacedRef = useRef(false);

  const [cartHydrated, setCartHydrated] = useState(() =>
    useCart.persist.hasHydrated()
  );
  const storeReady = isDemo
    ? cartHydrated
    : cartHydrated && sessionHydrated;
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const breakdown = taxBreakdown(isTakeaway, taxPercent);
  const computedTax = taxAmount(isTakeaway, taxPercent);
  const preDiscountTotal = total(isTakeaway, taxPercent);
  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const computedTotal = Math.max(
    0,
    Math.round((preDiscountTotal - discountAmount) * 100) / 100
  );

  useEffect(() => {
    if (useCart.persist.hasHydrated()) {
      setCartHydrated(true);
    }
    return useCart.persist.onFinishHydration(() => setCartHydrated(true));
  }, []);

  useEffect(() => {
    if (!storeReady || orderPlacedRef.current) return;
    if (!items.length) {
      router.replace(`/${slug}/${token}/cart`);
      return;
    }
    if (!sessionToken && !isDemo) {
      router.replace(`/${slug}/${token}/cart`);
      return;
    }
    setReady(true);
  }, [storeReady, items.length, sessionToken, isDemo, slug, token, router]);

  async function handlePlaceOrder() {
    if (!sessionToken || !isOnline) return;
    setProcessing(true);
    setError(null);

    try {
      await saveGuestEmail(sessionToken, guestEmail);

      const res = await fetchWithRetry("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          tableToken: token,
          items,
          guestEmail: guestEmail.trim() || undefined,
          isTakeaway,
          paymentMethod: "unset",
          promoCodeId: appliedPromo?.promoCodeId,
        }),
      });

      if (isServerErrorStatus(res.status)) {
        throw new Error(tUI("error.orderFailed"));
      }

      const parsed = await readJsonResponse<{
        error?: string;
        details?: { products?: string[] };
        data?: { orderId: string };
      }>(res);

      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      const json = parsed.data;
      if (!res.ok || !json.data?.orderId) {
        if (
          json.error === "unavailable_products" &&
          Array.isArray(json.details?.products)
        ) {
          for (const name of json.details.products) {
            toast.error(tUI("cart.unavailableProduct", { name }));
          }
        }
        throw new Error(json.error ?? tUI("error.orderFailed"));
      }

      orderPlacedRef.current = true;
      recordGuestOrderPlaced();
      hapticSuccess();
      router.replace(`/${slug}/${token}/order/${json.data.orderId}?placed=1`);
      clearCart();
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        enqueueOfflineOrder({
          sessionToken,
          tableToken: token,
          payload: {
            sessionToken,
            tableToken: token,
            items,
            guestEmail: guestEmail.trim() || undefined,
            isTakeaway,
            paymentMethod: "unset",
            promoCodeId: appliedPromo?.promoCodeId,
          },
        });
        void registerOrderSync();
        toast.success(tUI("offline.orderQueued"));
        setProcessing(false);
        return;
      }
      setError(e instanceof Error ? e.message : tUI("error.generic"));
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {tUI("checkout.takeaway")}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {tUI("checkout.takeawayHint")}
            </p>
          </div>
          <Switch
            checked={isTakeaway}
            onCheckedChange={setIsTakeaway}
            aria-label={tUI("checkout.takeaway")}
          />
        </div>
      </div>

      <PromoInput
        locationId={locationId}
        orderAmount={preDiscountTotal}
        currency={currency}
        value={appliedPromo}
        onChange={setAppliedPromo}
      />

      <OrderSummary
        items={items}
        subtotal={subtotal}
        taxBreakdown={breakdown}
        taxAmount={computedTax}
        total={computedTotal}
        discountAmount={discountAmount}
        currency={currency}
        tUI={tUI}
      />

      <div>
        <Label htmlFor="checkout-email" className="text-zinc-400">
          {tUI("checkout.email")}
        </Label>
        <Input
          id="checkout-email"
          type="email"
          placeholder={tUI("checkout.emailPlaceholder")}
          className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-zinc-500">{tUI("checkout.emailHint")}</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <UpsellBar
        locationId={locationId}
        currency={currency}
        variant="checkout"
      />

      <Button
        type="button"
        disabled={processing || !isOnline}
        onClick={handlePlaceOrder}
        className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600 disabled:animate-pulse"
      >
        {processing
          ? tUI("checkout.placingOrderWithTotal", {
              amount: formatPrice(computedTotal, currency),
            })
          : !isOnline
            ? tUI("offline.banner")
            : tUI("checkout.placeOrderWithTotal", {
                amount: formatPrice(computedTotal, currency),
              })}
      </Button>
    </div>
  );
}
