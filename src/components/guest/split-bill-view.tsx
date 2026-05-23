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
import { Lock, Minus, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";
import { formatPrice } from "@/lib/format";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { readJsonResponse } from "@/lib/api/read-json-response";
import { TipSelector } from "@/components/guest/tip-selector";
import { MIN_SPLIT_PARTS, MAX_SPLIT_PARTS } from "@/lib/orders/split-payments";
import { Button } from "@/components/ui/button";

type SplitItem = {
  id: string;
  product_name: string;
  quantity: number;
  total: number;
  assigned: boolean;
};

type SplitPart = {
  id: string;
  amount: number;
  tip_amount: number;
  chargeTotal: number;
  payment_status: string;
  items: string[] | null;
  clientSecret: string | null;
};

type SplitState = {
  order: {
    id: string;
    total: number;
    subtotal: number;
    tipAmount: number;
    paymentStatus: string;
    isSplit: boolean;
    chargeTotal: number;
  };
  items: SplitItem[];
  splits: SplitPart[];
  progress: { paid: number; total: number };
  remaining: number;
  stripeAccountId: string | null;
  currency: string;
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

function SplitPayForm({
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
    <form onSubmit={handlePay} className="space-y-4">
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

export function SplitBillView({
  slug,
  token,
  orderId,
  sessionToken,
}: {
  slug: string;
  token: string;
  orderId: string;
  sessionToken: string;
}) {
  const { tUI } = useAppLocale();
  const [state, setState] = useState<SplitState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"equal" | "by_items">("equal");
  const [parts, setParts] = useState(2);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeSplitId, setActiveSplitId] = useState<string | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTip, setSelectedTip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/orders/${orderId}/split?sessionToken=${encodeURIComponent(sessionToken)}&tableToken=${encodeURIComponent(token)}`
    );
    const parsed = await readJsonResponse<{ data?: SplitState; error?: string }>(
      res
    );
    if (parsed.ok && parsed.data.data) {
      setState(parsed.data.data);
      if (parsed.data.data.order.tipAmount > 0) {
        setSelectedTip(parsed.data.data.order.tipAmount);
      }
    }
    setLoading(false);
  }, [orderId, sessionToken, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTotal = useMemo(() => {
    if (!state) return 0;
    return state.items
      .filter((i) => selectedItems.has(i.id))
      .reduce((sum, i) => sum + i.total, 0);
  }, [state, selectedItems]);

  const myUnpaidSplit = useMemo(() => {
    if (!state) return null;
    return (
      state.splits.find(
        (s) => s.payment_status !== "paid" && s.clientSecret
      ) ?? null
    );
  }, [state]);

  const activeSplit = useMemo(() => {
    if (!state || !activeSplitId) return myUnpaidSplit;
    return state.splits.find((s) => s.id === activeSplitId) ?? myUnpaidSplit;
  }, [state, activeSplitId, myUnpaidSplit]);

  async function handleCreateSplit() {
    if (!state) return;
    setSubmitting(true);
    setError(null);

    const body =
      mode === "equal"
        ? {
            mode: "equal" as const,
            parts,
            sessionToken,
            tableToken: token,
            tipAmount: selectedTip,
          }
        : {
            mode: "by_items" as const,
            items: Array.from(selectedItems),
            sessionToken,
            tableToken: token,
            tipAmount: selectedTip,
          };

    try {
      const res = await fetch(`/api/orders/${orderId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const parsed = await readJsonResponse<{ error?: string }>(res);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tUI("error.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 px-4 py-8">
        <div className="h-8 w-48 rounded bg-zinc-800" />
        <div className="h-40 rounded-xl bg-zinc-900" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        {tUI("error.generic")}
      </div>
    );
  }

  const currency = state.currency;
  const isPaid = state.order.paymentStatus === "paid";
  const showSetup = state.splits.length === 0 && !isPaid;
  const showAddItemsPart =
    !isPaid && !showSetup && state.remaining > 0.01 && addingPart;
  const stripePromise =
    activeSplit?.clientSecret && state.stripeAccountId
      ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
          stripeAccount: state.stripeAccountId,
        })
      : null;

  return (
    <div className="px-4 pb-10 pt-6">
      <Link
        href={`/${slug}/${token}/order/${orderId}`}
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← {tUI("common.back")}
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-zinc-50">
        {tUI("split.title")}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">{tUI("split.subtitle")}</p>

      {state.progress.total > 0 && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {tUI("split.progress")}
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">
            {tUI("split.paidParts", {
              paid: state.progress.paid,
              total: state.progress.total,
            })}
          </p>
        </div>
      )}

      {isPaid && (
        <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
          {tUI("bill.paid")}
        </div>
      )}

      {showSetup && (
        <div className="mt-6 space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("equal")}
              className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                mode === "equal"
                  ? "border-orange-500 bg-orange-500/10 text-orange-400"
                  : "border-zinc-800 text-zinc-400"
              }`}
            >
              <Users className="mx-auto mb-1 size-5" />
              {tUI("split.modeEqual")}
            </button>
            <button
              type="button"
              onClick={() => setMode("by_items")}
              className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                mode === "by_items"
                  ? "border-orange-500 bg-orange-500/10 text-orange-400"
                  : "border-zinc-800 text-zinc-400"
              }`}
            >
              {tUI("split.modeItems")}
            </button>
          </div>

          {mode === "equal" ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-400">{tUI("split.people")}</p>
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label={tUI("split.decrease")}
                  disabled={parts <= MIN_SPLIT_PARTS}
                  onClick={() => setParts((p) => Math.max(MIN_SPLIT_PARTS, p - 1))}
                  className="flex size-12 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 disabled:opacity-40"
                >
                  <Minus className="size-5" />
                </button>
                <span className="text-3xl font-bold tabular-nums text-zinc-50">
                  {parts}
                </span>
                <button
                  type="button"
                  aria-label={tUI("split.increase")}
                  disabled={parts >= MAX_SPLIT_PARTS}
                  onClick={() => setParts((p) => Math.min(MAX_SPLIT_PARTS, p + 1))}
                  className="flex size-12 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 disabled:opacity-40"
                >
                  <Plus className="size-5" />
                </button>
              </div>
              <p className="mt-4 text-center text-sm text-zinc-500">
                {tUI("split.perPerson", {
                  amount: formatPrice(state.order.total / parts, currency),
                })}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-sm text-zinc-400">{tUI("split.pickItems")}</p>
              <div className="space-y-2">
                {state.items.map((item) => {
                  const disabled = item.assigned;
                  const checked = selectedItems.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-3 ${
                        disabled
                          ? "border-zinc-800 opacity-50"
                          : checked
                            ? "border-orange-500/50 bg-orange-500/5"
                            : "border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={() => {
                            setSelectedItems((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          className="size-5 accent-orange-500"
                        />
                        <span className="text-sm text-zinc-200">
                          {item.quantity}× {item.product_name}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums text-zinc-400">
                        {formatPrice(item.total, currency)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-lg font-semibold text-orange-400">
                {tUI("split.yourShare", {
                  amount: formatPrice(selectedTotal, currency),
                })}
              </p>
            </div>
          )}

          {state.order.tipAmount <= 0 && (
            <TipSelector
              subtotal={state.order.subtotal}
              orderTotal={state.order.total}
              currency={currency}
              value={selectedTip}
              onChange={setSelectedTip}
            />
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="button"
            disabled={
              submitting ||
              (mode === "by_items" && selectedItems.size === 0)
            }
            onClick={handleCreateSplit}
            className="h-12 w-full rounded-xl bg-orange-500 font-bold hover:bg-orange-600"
          >
            {submitting ? tUI("bill.processing") : tUI("split.create")}
          </Button>
        </div>
      )}

      {!showSetup && !isPaid && state.splits.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            {state.splits.map((split, index) => {
              const paid = split.payment_status === "paid";
              return (
                <button
                  key={split.id}
                  type="button"
                  disabled={paid || !split.clientSecret}
                  onClick={() => setActiveSplitId(split.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition ${
                    activeSplit?.id === split.id
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-zinc-800 bg-zinc-900"
                  } ${paid ? "opacity-60" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {tUI("split.part", { n: index + 1 })}
                      {paid ? " ✓" : ""}
                    </p>
                    {split.items && split.items.length > 0 && (
                      <p className="text-xs text-zinc-500">
                        {tUI("split.itemsCount", { count: split.items.length })}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold tabular-nums text-zinc-100">
                    {formatPrice(split.chargeTotal, currency)}
                  </span>
                </button>
              );
            })}
          </div>

          {state.remaining > 0.01 && !addingPart && (
            <div className="rounded-xl border border-dashed border-zinc-700 p-4">
              <p className="text-sm text-zinc-500">
                {tUI("split.remaining", {
                  amount: formatPrice(state.remaining, currency),
                })}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-zinc-700"
                onClick={() => {
                  setMode("by_items");
                  setSelectedItems(new Set());
                  setAddingPart(true);
                }}
              >
                {tUI("split.addPart")}
              </Button>
            </div>
          )}

          {showAddItemsPart && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="mb-3 text-sm text-zinc-400">{tUI("split.pickItems")}</p>
              <div className="space-y-2">
                {state.items.map((item) => {
                  const disabled = item.assigned;
                  const checked = selectedItems.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-3 ${
                        disabled
                          ? "border-zinc-800 opacity-50"
                          : checked
                            ? "border-orange-500/50 bg-orange-500/5"
                            : "border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={() => {
                            setSelectedItems((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          className="size-5 accent-orange-500"
                        />
                        <span className="text-sm text-zinc-200">
                          {item.quantity}× {item.product_name}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums text-zinc-400">
                        {formatPrice(item.total, currency)}
                      </span>
                    </label>
                  );
                })}
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-700"
                  onClick={() => setAddingPart(false)}
                >
                  {tUI("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={submitting || selectedItems.size === 0}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={async () => {
                    setSubmitting(true);
                    setError(null);
                    try {
                      const res = await fetch(`/api/orders/${orderId}/split`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mode: "by_items",
                          items: Array.from(selectedItems),
                          sessionToken,
                          tableToken: token,
                          tipAmount: selectedTip,
                        }),
                      });
                      const parsed = await readJsonResponse<{ error?: string }>(
                        res
                      );
                      if (!parsed.ok) throw new Error(parsed.error);
                      setAddingPart(false);
                      setSelectedItems(new Set());
                      await load();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : tUI("error.generic")
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {submitting ? tUI("bill.processing") : tUI("split.create")}
                </Button>
              </div>
            </div>
          )}

          {activeSplit?.clientSecret && stripePromise && !showAddItemsPart && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-400">{tUI("split.payShare")}</p>
              <p className="text-2xl font-bold tabular-nums text-zinc-50">
                {formatPrice(activeSplit.chargeTotal, currency)}
              </p>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: activeSplit.clientSecret,
                  appearance,
                }}
              >
                <SplitPayForm
                  total={activeSplit.chargeTotal}
                  currency={currency}
                  tUI={tUI}
                  onSuccess={() => {
                    setActiveSplitId(null);
                    void load();
                  }}
                />
              </Elements>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
