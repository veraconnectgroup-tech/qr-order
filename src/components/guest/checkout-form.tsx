"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { CheckoutTrustBadges } from "@/components/guest/checkout-trust-badges";
import { CheckoutSkeleton } from "@/components/guest/checkout-skeleton";
import { readJsonResponse } from "@/lib/api/read-json-response";
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

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#f97316",
    colorBackground: "#18181b",
    colorText: "#fafafa",
    colorDanger: "#ef4444",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #3f3f46",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #f97316",
      boxShadow: "0 0 0 1px #f97316",
    },
  },
};

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
    </div>
  );
}

function DemoCheckoutForm({
  slug,
  token,
  taxPercent,
  currency,
  items,
  sessionToken,
  subtotal,
  taxAmount,
  total,
}: {
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
  items: CartItem[];
  sessionToken: string;
  subtotal: number;
  taxAmount: number;
  total: number;
}) {
  const router = useRouter();
  const clearCart = useCart((s) => s.clearCart);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");

  async function placeOrder() {
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
        }),
      });
      const parsed = await readJsonResponse<{ error?: string; data?: { orderId: string } }>(
        res
      );
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      const json = parsed.data;
      if (!res.ok) {
        throw new Error(json.error ?? "Order could not be placed.");
      }
      if (!json.data?.orderId) {
        throw new Error("Order could not be placed.");
      }
      clearCart();
      hapticSuccess();
      toast.success("Order sent!");
      router.push(`/${slug}/${token}/order/${json.data.orderId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setProcessing(false);
    }
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
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90">
        Demo mode — Stripe is not connected. Place the order and staff will handle
        payment at the table.
      </div>
      <div>
        <Label htmlFor="demo-email" className="text-zinc-400">
          Email (optional, for receipt)
        </Label>
        <Input
          id="demo-email"
          type="email"
          placeholder="you@example.com"
          className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button
        type="button"
        disabled={processing}
        onClick={placeOrder}
        className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600"
      >
        {processing ? "Sending order…" : "Place order"}
      </Button>
    </div>
  );
}

function PaymentForm({
  slug,
  token,
  orderId,
  total,
  currency,
  sessionToken,
  guestEmail,
  onEmailChange,
}: {
  slug: string;
  token: string;
  orderId: string;
  total: number;
  currency: string;
  sessionToken: string;
  guestEmail: string;
  onEmailChange: (email: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const clearCart = useCart((s) => s.clearCart);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    await saveGuestEmail(sessionToken, guestEmail);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${slug}/${token}/order/${orderId}`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment failed.");
      setProcessing(false);
      return;
    }

    clearCart();
    hapticSuccess();
    toast.success("Payment successful!");
    router.push(`/${slug}/${token}/order/${orderId}`);
  }

  return (
    <form onSubmit={handlePay} className="space-y-6">
      <CheckoutTrustBadges />
      <PaymentElement options={{ layout: "tabs" }} />

      <div>
        <Label htmlFor="email" className="text-zinc-400">
          Email (optional, for receipt)
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          value={guestEmail}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600"
      >
        {processing ? "Processing..." : `Pay ${formatPrice(total, currency)}`}
      </Button>

      <p className="text-center text-xs text-zinc-500">
        Your payment info never touches our servers
      </p>
      <p className="flex items-center justify-center gap-1 text-micro text-zinc-500">
        <Lock className="size-3" />
        Secure payment via Stripe
      </p>
    </form>
  );
}

export function CheckoutForm({
  slug,
  token,
  taxPercent,
  currency,
  stripeOnboarded,
}: {
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
  stripeOnboarded: boolean;
}) {
  const items = useCart((s) => s.items);
  const sessionToken = useCart((s) => s.sessionToken);
  const subtotal = useCart((s) => s.subtotal());
  const taxAmount = useCart((s) => s.taxAmount(taxPercent));
  const total = useCart((s) => s.total(taxPercent));
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const stripeEnabled =
    stripeOnboarded && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const initCheckout = useCallback(async () => {
    if (!items.length || !sessionToken) {
      router.replace(`/${slug}/${token}/cart`);
      return;
    }

    if (!stripeEnabled) {
      setLoading(false);
      return;
    }

    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          tableToken: token,
          items,
          guestEmail: guestEmail || undefined,
        }),
      });

      const orderParsed = await readJsonResponse<{
        error?: string;
        data?: { orderId: string };
      }>(orderRes);
      if (!orderParsed.ok) {
        throw new Error(orderParsed.error);
      }
      const orderJson = orderParsed.data;
      if (!orderRes.ok) {
        throw new Error(orderJson.error ?? "Order could not be placed.");
      }

      const oid = orderJson.data?.orderId;
      if (!oid) {
        throw new Error("Order could not be placed.");
      }
      setOrderId(oid);

      const payRes = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: oid, sessionToken }),
      });

      const payParsed = await readJsonResponse<{
        error?: string;
        data?: { clientSecret: string; stripeAccountId: string };
      }>(payRes);
      if (!payParsed.ok) {
        throw new Error(payParsed.error);
      }
      const payJson = payParsed.data;
      if (!payRes.ok) {
        throw new Error(payJson.error ?? "Payment could not be started.");
      }

      if (!payJson.data?.clientSecret || !payJson.data?.stripeAccountId) {
        throw new Error("Payment could not be started.");
      }

      setClientSecret(payJson.data.clientSecret);
      setStripeAccountId(payJson.data.stripeAccountId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load checkout.");
    } finally {
      setLoading(false);
    }
  }, [items, sessionToken, slug, token, stripeEnabled, router, guestEmail]);

  useEffect(() => {
    initCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="py-6">
        <CheckoutSkeleton />
      </div>
    );
  }

  if (!stripeEnabled) {
    return (
      <DemoCheckoutForm
        slug={slug}
        token={token}
        taxPercent={taxPercent}
        currency={currency}
        items={items}
        sessionToken={sessionToken!}
        subtotal={subtotal}
        taxAmount={taxAmount}
        total={total}
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-zinc-900 p-6 text-center">
        <p className="text-body text-red-400">{error}</p>
        <Button
          variant="outline"
          className="mt-4 border-zinc-700"
          onClick={() => router.push(`/${slug}/${token}/cart`)}
        >
          Back to cart
        </Button>
      </div>
    );
  }

  if (!clientSecret || !stripeAccountId || !orderId) return null;

  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    { stripeAccount: stripeAccountId }
  );

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
        <h2 className="text-caption mb-4 uppercase tracking-wide text-zinc-500">
          Payment
        </h2>
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance }}
        >
          <PaymentForm
            slug={slug}
            token={token}
            orderId={orderId}
            total={total}
            currency={currency}
            sessionToken={sessionToken!}
            guestEmail={guestEmail}
            onEmailChange={setGuestEmail}
          />
        </Elements>
      </div>
    </div>
  );
}
