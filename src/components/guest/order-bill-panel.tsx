"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { inPersonPaymentKeys } from "@/lib/i18n/translations";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  getAvailablePaymentMethods,
  type SelectablePaymentMethod,
} from "@/lib/payment-methods";
import { PaymentMethodSelector } from "@/components/guest/payment-method-selector";
import { TipSelector } from "@/components/guest/tip-selector";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { Button } from "@/components/ui/button";

type SplitProgress = {
  paid: number;
  total: number;
  isSplit: boolean;
};

type SessionBill = {
  amountDue: number;
  tipAmount: number;
  chargeTotal: number;
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
  tUI,
}: {
  total: number;
  currency: string;
  onSuccess: () => void;
  tUI: ReturnType<typeof useAppLocale>["tUI"];
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
      setError(submitError.message ?? tUI("error.paymentFailed"));
      setProcessing(false);
      return;
    }

    hapticSuccess();
    toast.success(tUI("bill.paymentSuccess"));
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
        {processing
          ? tUI("bill.processing")
          : tUI("checkout.pay", { amount: formatPrice(total, currency) })}
      </Button>
      <p className="flex items-center justify-center gap-1 text-xs text-zinc-500">
        <Lock className="size-3" />
        {tUI("bill.secureStripe")}
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
  slug,
  orderId,
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
  slug?: string;
  orderId?: string;
}) {
  const { tUI } = useAppLocale();
  const [bill, setBill] = useState<SessionBill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SelectablePaymentMethod | null>(
    null
  );
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargeTotal, setChargeTotal] = useState<number | null>(null);
  const [selectedTip, setSelectedTip] = useState(0);
  const [splitProgress, setSplitProgress] = useState<SplitProgress | null>(null);

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

  const loadSplitProgress = useCallback(async () => {
    if (!orderId) return;
    const res = await fetch(
      `/api/orders/${orderId}/split?sessionToken=${encodeURIComponent(sessionToken)}&tableToken=${encodeURIComponent(token)}`
    );
    if (!res.ok) return;
    const json = await res.json();
    const data = json.data as {
      progress: { paid: number; total: number };
      order: { isSplit: boolean; paymentStatus: string };
    };
    if (data?.progress) {
      setSplitProgress({
        paid: data.progress.paid,
        total: data.progress.total,
        isSplit: data.order.isSplit,
      });
    }
  }, [orderId, sessionToken, token]);

  useEffect(() => {
    if (!isPaid) {
      void loadBill();
      void loadSplitProgress();
    }
  }, [isPaid, loadBill, loadSplitProgress]);

  useEffect(() => {
    setChargeTotal(null);
    setClientSecret(null);
  }, [bill?.amountDue, selectedTip]);

  useEffect(() => {
    if (bill && bill.tipAmount > 0) {
      setSelectedTip(bill.tipAmount);
    }
  }, [bill?.tipAmount, bill?.amountDue]);

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
            tipAmount: selectedTip,
          }),
        });
        const parsed = await readJsonResponse<{
          error?: string;
          data?: {
            clientSecret: string;
            stripeAccountId: string;
            chargeTotal?: number;
          };
        }>(res);
        if (!parsed.ok) {
          throw new Error(parsed.error);
        }
        if (!res.ok || !parsed.data.data?.clientSecret) {
          throw new Error(parsed.data.error ?? tUI("error.paymentFailed"));
        }
        setChargeTotal(parsed.data.data.chargeTotal ?? bill.chargeTotal);
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
          tipAmount: selectedTip,
        }),
      });
      const parsed = await readJsonResponse<{ error?: string }>(res);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      hapticSuccess();
      toast.success(
        paymentMethod === "at_bar"
          ? tUI(inPersonPaymentKeys(inPersonPaymentLocation).confirm)
          : tUI("payment.cardAtTable.confirm")
      );
      onPaid();
      loadBill();
    } catch (e) {
      setError(e instanceof Error ? e.message : tUI("error.generic"));
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
            <p className="font-semibold text-green-300">{tUI("bill.paid")}</p>
            <p className="text-sm text-green-200/70">{tUI("bill.thankYou")}</p>
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

  const payTotal = chargeTotal ?? bill.amountDue + selectedTip;
  const canSplit =
    Boolean(slug && orderId) &&
    stripeOnboarded &&
    paymentOnlineEnabled &&
    !splitProgress?.isSplit;
  const isSplitActive = Boolean(splitProgress?.isSplit && splitProgress.total > 0);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-2">
        <Receipt className="size-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-zinc-50">{tUI("bill.myBill")}</h2>
      </div>
      {isSplitActive && (
        <p className="mt-2 text-sm text-orange-400/90">
          {tUI("split.paidParts", {
            paid: splitProgress!.paid,
            total: splitProgress!.total,
          })}
        </p>
      )}
      {bill.unpaidCount > 1 && (
        <p className="mt-1 text-xs text-zinc-500">
          {tUI("bill.openOrders", { count: bill.unpaidCount })}
        </p>
      )}

      <div className="mt-4 rounded-lg bg-zinc-950 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {tUI("bill.amountDue")}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-50">
          {formatPrice(payTotal, currency)}
        </p>
        {selectedTip > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            {formatPrice(bill.amountDue, currency)} + {tUI("checkout.tip")}{" "}
            {formatPrice(selectedTip, currency)}
          </p>
        )}
        {bill.taxAmount > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            {tUI("bill.inclTax", {
              amount: formatPrice(bill.taxAmount, currency),
            })}
          </p>
        )}
      </div>

      {!clientSecret && (
        <>
          {!isSplitActive && (
            <div className="mt-5">
              <TipSelector
                subtotal={bill.subtotal}
                orderTotal={bill.amountDue}
                currency={currency}
                value={selectedTip}
                onChange={setSelectedTip}
              />
            </div>
          )}
          {!isSplitActive && (
            <div className="mt-5">
              <PaymentMethodSelector
                methods={availableMethods}
                value={paymentMethod}
                onChange={setPaymentMethod}
                inPersonPaymentLocation={inPersonPaymentLocation}
              />
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {canSplit && (
              <Button
                type="button"
                variant="outline"
                asChild
                className="h-12 flex-1 rounded-xl border-zinc-700 bg-transparent font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                <Link href={`/${slug}/${token}/split?orderId=${orderId}`}>
                  {tUI("split.title")}
                </Link>
              </Button>
            )}
            {isSplitActive && slug && orderId && (
              <Button
                type="button"
                asChild
                className="h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600 sm:flex-1"
              >
                <Link href={`/${slug}/${token}/split?orderId=${orderId}`}>
                  {tUI("split.continue")}
                </Link>
              </Button>
            )}
            {!isSplitActive && (
              <Button
                type="button"
                disabled={!paymentMethod || processing}
                onClick={handleConfirmPayment}
                className="h-12 flex-1 rounded-xl bg-orange-500 font-bold hover:bg-orange-600"
              >
                {processing
                  ? tUI("bill.processing")
                  : paymentMethod === "online"
                    ? tUI("bill.continueCard")
                    : tUI("bill.confirmMethod")}
              </Button>
            )}
          </div>
        </>
      )}

      {clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <StripePayForm
            total={payTotal}
            currency={currency}
            tUI={tUI}
            onSuccess={() => {
              setClientSecret(null);
              setChargeTotal(null);
              onPaid();
              loadBill();
            }}
          />
        </Elements>
      )}
    </div>
  );
}
