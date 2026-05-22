"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Lock, Receipt } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";
import { formatPrice } from "@/lib/format";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  getAvailablePaymentMethods,
  inPersonPaymentConfirmToast,
  type SelectablePaymentMethod,
} from "@/lib/payment-methods";
import { PaymentMethodSelector } from "@/components/guest/payment-method-selector";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { Button } from "@/components/ui/button";

type SessionBill = {
  amountDue: number;
  subtotal: number;
  taxAmount: number;
  unpaidCount: number;
  orderCount: number;
};

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#f97316",
    colorBackground: "#18181b",
    colorText: "#fafafa",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "10px",
  },
};

function StripePayForm({
  total,
  currency,
  onSuccess,
}: {
  total: number;
  currency: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment failed.");
      setProcessing(false);
      return;
    }

    hapticSuccess();
    toast.success("Payment successful!");
    onSuccess();
  }

  return (
    <form onSubmit={handlePay} className="mt-4 space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600"
      >
        {processing ? "Processing..." : `Pay ${formatPrice(total, currency)}`}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-zinc-500">
        <Lock className="size-3" />
        Secure payment via Stripe
      </p>
    </form>
  );
}

export function OrderBillPanel({
  token,
  sessionToken,
  currency,
  stripeOnboarded,
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
  inPersonPaymentLocation = "bar",
  isPaid,
  onPaid,
}: {
  token: string;
  sessionToken: string;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
  isPaid: boolean;
  onPaid: () => void;
}) {
  const [bill, setBill] = useState<SessionBill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SelectablePaymentMethod | null>(
    null
  );
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableMethods = useMemo(
    () =>
      getAvailablePaymentMethods({
        stripeOnboarded,
        stripePublishableKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        paymentOnlineEnabled,
        paymentAtBarEnabled,
        paymentCardAtTableEnabled,
      }),
    [
      stripeOnboarded,
      paymentOnlineEnabled,
      paymentAtBarEnabled,
      paymentCardAtTableEnabled,
    ]
  );

  const loadBill = useCallback(async () => {
    const res = await fetch(
      `/api/sessions/bill?sessionToken=${encodeURIComponent(sessionToken)}&tableToken=${encodeURIComponent(token)}`
    );
    if (!res.ok) return;
    const json = await res.json();
    setBill(json.data as SessionBill);
  }, [sessionToken, token]);

  useEffect(() => {
    if (!isPaid) loadBill();
  }, [isPaid, loadBill]);

  async function handleConfirmPayment() {
    if (!paymentMethod || !bill || bill.amountDue <= 0) return;
    setProcessing(true);
    setError(null);

    try {
      if (paymentMethod === "online") {
        const res = await fetch("/api/sessions/bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionToken,
            tableToken: token,
            paymentMethod: "online",
          }),
        });
        const parsed = await readJsonResponse<{
          error?: string;
          data?: { clientSecret: string; stripeAccountId: string };
        }>(res);
        if (!parsed.ok) {
          throw new Error(parsed.error);
        }
        if (!res.ok || !parsed.data.data?.clientSecret) {
          throw new Error(parsed.data.error ?? "Payment failed.");
        }
        setClientSecret(parsed.data.data.clientSecret);
        setStripeAccountId(parsed.data.data.stripeAccountId);
        setProcessing(false);
        return;
      }

      const res = await fetch("/api/sessions/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          tableToken: token,
          paymentMethod,
        }),
      });
      const parsed = await readJsonResponse<{ error?: string }>(res);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      hapticSuccess();
      toast.success(
        paymentMethod === "at_bar"
          ? inPersonPaymentConfirmToast(inPersonPaymentLocation)
          : "Staff will bring a card terminal"
      );
      onPaid();
      loadBill();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  }

  if (isPaid) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
        <div className="flex items-center gap-3">
          <Receipt className="size-5 text-green-400" />
          <div>
            <p className="font-semibold text-green-300">Bill paid</p>
            <p className="text-sm text-green-200/70">Thank you!</p>
          </div>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="animate-pulse rounded-xl bg-zinc-900 p-5">
        <div className="h-6 w-32 rounded bg-zinc-800" />
        <div className="mt-4 h-10 rounded bg-zinc-800" />
      </div>
    );
  }

  if (bill.amountDue <= 0) {
    return null;
  }

  const stripePromise =
    clientSecret && stripeAccountId
      ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
          stripeAccount: stripeAccountId,
        })
      : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-2">
        <Receipt className="size-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-zinc-50">My bill</h2>
      </div>
      {bill.unpaidCount > 1 && (
        <p className="mt-1 text-xs text-zinc-500">
          {bill.unpaidCount} open orders at your table
        </p>
      )}

      <div className="mt-4 rounded-lg bg-zinc-950 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Amount due
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-50">
          {formatPrice(bill.amountDue, currency)}
        </p>
        {bill.taxAmount > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            incl. tax {formatPrice(bill.taxAmount, currency)}
          </p>
        )}
      </div>

      {!clientSecret && (
        <>
          <div className="mt-5">
            <PaymentMethodSelector
              methods={availableMethods}
              value={paymentMethod}
              onChange={setPaymentMethod}
              inPersonPaymentLocation={inPersonPaymentLocation}
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <Button
            type="button"
            disabled={!paymentMethod || processing}
            onClick={handleConfirmPayment}
            className="mt-4 h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600"
          >
            {processing
              ? "Processing..."
              : paymentMethod === "online"
                ? "Continue to card payment"
                : "Confirm payment method"}
          </Button>
        </>
      )}

      {clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <StripePayForm
            total={bill.amountDue}
            currency={currency}
            onSuccess={() => {
              setClientSecret(null);
              onPaid();
              loadBill();
            }}
          />
        </Elements>
      )}
    </div>
  );
}
