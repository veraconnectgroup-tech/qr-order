"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { PaymentMethod } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { getAvailablePaymentMethods } from "@/lib/payment-methods";
import { CheckoutTrustBadges } from "@/components/guest/checkout-trust-badges";
import { CheckoutSkeleton } from "@/components/guest/checkout-skeleton";
import { PaymentMethodSelector } from "@/components/guest/payment-method-selector";
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
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
}: {
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
}) {
  const items = useCart((s) => s.items);
  const sessionToken = useCart((s) => s.sessionToken);
  const subtotal = useCart((s) => s.subtotal());
  const taxAmount = useCart((s) => s.taxAmount(taxPercent));
  const total = useCart((s) => s.total(taxPercent));
  const clearCart = useCart((s) => s.clearCart);
  const router = useRouter();

  const stripePublishableKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const availableMethods = useMemo(
    () =>
      getAvailablePaymentMethods({
        stripeOnboarded,
        stripePublishableKey,
        paymentOnlineEnabled,
        paymentAtBarEnabled,
        paymentCardAtTableEnabled,
      }).sort((a, b) => {
        const order = { at_bar: 0, card_at_table: 1, online: 2 };
        return order[a] - order[b];
      }),
    [
      stripeOnboarded,
      stripePublishableKey,
      paymentOnlineEnabled,
      paymentAtBarEnabled,
      paymentCardAtTableEnabled,
    ]
  );

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"choose" | "online">("choose");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!items.length || !sessionToken) {
      router.replace(`/${slug}/${token}/cart`);
      return;
    }
    setReady(true);
  }, [items.length, sessionToken, slug, token, router]);

  useEffect(() => {
    if (availableMethods.length === 1) {
      setPaymentMethod(availableMethods[0]!);
    }
  }, [availableMethods]);

  const placeOrder = useCallback(
    async (method: PaymentMethod) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          tableToken: token,
          items,
          guestEmail: guestEmail || undefined,
          paymentMethod: method,
        }),
      });

      const parsed = await readJsonResponse<{
        error?: string;
        data?: { orderId: string };
      }>(res);

      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      const json = parsed.data;
      if (!res.ok) {
        throw new Error(json.error ?? "Order could not be placed.");
      }

      const oid = json.data?.orderId;
      if (!oid) {
        throw new Error("Order could not be placed.");
      }

      return oid;
    },
    [guestEmail, items, sessionToken, token]
  );

  async function handleContinue() {
    if (!paymentMethod || !sessionToken) return;

    setProcessing(true);
    setError(null);

    try {
      await saveGuestEmail(sessionToken, guestEmail);

      if (paymentMethod === "online") {
        const oid = await placeOrder("online");

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

        setOrderId(oid);
        setClientSecret(payJson.data.clientSecret);
        setStripeAccountId(payJson.data.stripeAccountId);
        setStep("online");
        setProcessing(false);
        return;
      }

      const oid = await placeOrder(paymentMethod);
      clearCart();
      hapticSuccess();
      toast.success("Order sent!");
      router.push(`/${slug}/${token}/order/${oid}`);
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

  if (step === "online" && clientSecret && stripeAccountId && orderId) {
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
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
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

      <PaymentMethodSelector
        methods={availableMethods}
        value={paymentMethod}
        onChange={setPaymentMethod}
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
        disabled={!paymentMethod || processing}
        onClick={handleContinue}
        className="h-14 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600"
      >
        {processing
          ? "Processing..."
          : paymentMethod === "online"
            ? "Continue to payment"
            : "Place order"}
      </Button>
    </div>
  );
}
