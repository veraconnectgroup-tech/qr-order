"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptics";
import { formatPrice } from "@/lib/format";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useCart } from "@/hooks/use-cart";
import {
  inPersonPaymentKeys,
  orderStatusHeadlineKey,
} from "@/lib/i18n/translations";
import {
  orderStatusStepIndex,
} from "@/lib/orders/order-status-display";
import { AnimatedOrderNumber } from "@/components/guest/animated-order-number";
import { CallWaiterButton } from "@/components/guest/call-waiter-button";
import { LanguageSelector } from "@/components/guest/language-selector";
import { OrderBillPanel } from "@/components/guest/order-bill-panel";
import { OrderPlacedOverlay } from "@/components/guest/order-placed-overlay";
import { AiFeedbackPrompt } from "@/components/guest/ai-feedback-prompt";
import { TypewriterText } from "@/components/guest/typewriter-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { InPersonPaymentLocation } from "@/lib/constants";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { useGuestMemory } from "@/hooks/use-guest-memory";
import { TaxBreakdownLines } from "@/components/shared/tax-breakdown";
import { TseReceiptBadge } from "@/components/guest/tse-receipt-badge";

type OrderData = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  tax_percent: number;
  total: number;
  rejection_reason: string | null;
  estimated_prep_minutes: number | null;
  created_at: string;
  accepted_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  beleg_token?: string | null;
  tse_signature?: string | null;
  tse_data?: {
    tss_serial?: string;
    signature_counter?: number;
    signature?: string;
    start_time?: number;
    end_time?: number;
    qr_code_data?: string;
  } | null;
  order_items: Array<{
    product_name: string;
    quantity: number;
    total: number;
    tax_rate?: number;
    notes: string | null;
    order_item_modifiers: Array<{ modifier_name: string }>;
  }>;
  tables: { name: string } | null;
};

const STEP_KEYS = [
  { key: "pending", field: "created_at" as const },
  { key: "accepted", field: "accepted_at" as const },
  { key: "preparing", field: "preparing_at" as const },
  { key: "ready", field: "ready_at" as const },
  { key: "delivered", field: "delivered_at" as const },
] as const;

const CLOSED_STATUSES = new Set(["rejected", "cancelled"]);

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shouldStopPolling(order: OrderData) {
  if (CLOSED_STATUSES.has(order.status)) return true;
  if (order.payment_status === "paid" && order.status === "delivered") {
    return !!order.beleg_token;
  }
  return false;
}

export function OrderStatusTracker({
  slug,
  token,
  orderId,
  sessionToken,
  locationId,
  currency,
  stripeOnboarded,
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
  googleReviewUrl,
  inPersonPaymentLocation,
}: {
  slug: string;
  token: string;
  orderId: string;
  sessionToken: string;
  locationId: string;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
  googleReviewUrl: string | null;
  inPersonPaymentLocation: InPersonPaymentLocation;
}) {
  const { tUI } = useAppLocale();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addItem = useCart((s) => s.addItem);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [showPlacedOverlay, setShowPlacedOverlay] = useState(
    () => searchParams.get("placed") === "1"
  );
  const prevStatus = useRef<string | null>(null);
  const [statusPulse, setStatusPulse] = useState(false);
  const hapticFired = useRef(false);
  const visitRecordedRef = useRef(false);
  const { recordVisit } = useGuestMemory(locationId);

  const refreshOrder = useCallback(
    async (retryOnMiss = false) => {
      const maxAttempts = retryOnMiss ? 8 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(
          `/api/orders/${orderId}?sessionToken=${encodeURIComponent(sessionToken)}`
        );

        if (res.ok) {
          const json = await res.json();
          return json.data as OrderData;
        }

        if (res.status === 401) {
          return null;
        }

        if (res.status === 404 && attempt < maxAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 350 * (attempt + 1))
          );
          continue;
        }

        return null;
      }

      return null;
    },
    [orderId, sessionToken]
  );

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setOrder(null);
      }
    });

    async function refresh(initial = false) {
      const data = await refreshOrder(initial);
      if (cancelled) return;
      if (data) {
        setOrder(data);
        if (shouldStopPolling(data) && pollId) {
          clearInterval(pollId);
          pollId = null;
        }
      }
      if (initial) setLoading(false);
    }

    void refresh(true);
    pollId = setInterval(() => void refresh(false), REALTIME_FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, [refreshOrder, orderId, sessionToken]);

  useEffect(() => {
    if (!order) return;
    if (prevStatus.current && prevStatus.current !== order.status) {
      setStatusPulse(true);
      setTimeout(() => setStatusPulse(false), 600);
    }
    prevStatus.current = order.status;
  }, [order?.status, order]);

  useEffect(() => {
    if (order && !hapticFired.current && order.payment_status === "paid") {
      hapticSuccess();
      hapticFired.current = true;
    }
  }, [order]);

  useEffect(() => {
    if (!order || order.status !== "delivered" || visitRecordedRef.current) {
      return;
    }

    const itemNames = order.order_items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => item.product_name)
    );
    if (!itemNames.length) return;

    visitRecordedRef.current = true;
    recordVisit(itemNames);
  }, [order, recordVisit]);

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-6">
        <Skeleton className="mx-auto h-8 w-48 bg-zinc-800" />
        <Skeleton className="mx-auto h-12 w-24 bg-zinc-800" />
        <Skeleton className="h-52 w-full rounded-xl bg-zinc-800" />
        <Skeleton className="h-40 w-full rounded-xl bg-zinc-800" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        {tUI("order.notFound")}
      </div>
    );
  }

  const isRejected = order.status === "rejected";
  const isCancelled = order.status === "cancelled";
  const isClosed = isRejected || isCancelled;
  const isCompleted = order.status === "delivered";
  const isPaid = order.payment_status === "paid";
  const canAddMore = !isClosed;
  const stepIdx = orderStatusStepIndex(order.status);
  const headline = tUI(
    orderStatusHeadlineKey(order.status, order.payment_status)
  );

  async function handleReorder() {
    setReordering(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, tableToken: token }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? tUI("error.generic"));
      }

      for (const name of json.data.skipped ?? []) {
        toast.error(tUI("order.reorderSkipped", { name }));
      }

      for (const item of json.data.cartItems ?? []) {
        addItem(item);
      }

      if ((json.data.cartItems ?? []).length > 0) {
        toast.success(tUI("order.reorderAdded"));
        router.push(`/${slug}/${token}/cart`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tUI("error.generic"));
    } finally {
      setReordering(false);
    }
  }

  let paymentHint: string | null = null;
  if (order.payment_status !== "paid" && order.payment_method !== "unset") {
    if (order.payment_method === "at_bar") {
      paymentHint = tUI(
        inPersonPaymentKeys(inPersonPaymentLocation).instruction
      );
    } else if (order.payment_method === "card_at_table") {
      paymentHint = tUI("payment.cardAtTable.instruction");
    }
  }

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      {showPlacedOverlay && (
        <OrderPlacedOverlay
          orderNumber={order.order_number}
          onComplete={() => {
            setShowPlacedOverlay(false);
            router.replace(`/${slug}/${token}/order/${orderId}`, {
              scroll: false,
            });
          }}
        />
      )}
      <div className="mb-3 flex justify-end">
        <LanguageSelector compact />
      </div>
      {/* Status hero */}
      <section className="pb-5 text-center" aria-live="polite" aria-atomic="true">
        {isRejected ? (
          <XCircle className="mx-auto size-14 text-red-500" />
        ) : (
          <motion.div
            initial={reduceMotion ? false : { scale: 0 }}
            animate={{ scale: statusPulse && !reduceMotion ? [1, 1.06, 1] : 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : statusPulse
                  ? { duration: 0.5 }
                  : { type: "spring", damping: 15, stiffness: 200 }
            }
          >
            <CheckCircle2 className="mx-auto size-16 text-green-500" />
          </motion.div>
        )}
        <h1 className="text-heading mt-4 text-zinc-50">{headline}</h1>
        {!isClosed && (
          <>
            <AnimatedOrderNumber orderNumber={order.order_number} />
            {order.estimated_prep_minutes != null &&
              stepIdx >= 0 &&
              stepIdx < 4 && (
                <p className="mt-2 text-sm text-zinc-400">
                  {tUI("order.estimatedMin", {
                    minutes: order.estimated_prep_minutes,
                  })}
                </p>
              )}
          </>
        )}
        {paymentHint && (
          <p className="mt-3 text-sm text-zinc-400">{paymentHint}</p>
        )}
        {isRejected && order.rejection_reason && (
          <p className="mt-2 text-sm text-zinc-400">{order.rejection_reason}</p>
        )}
      </section>

      {/* Live status timeline */}
      {!isClosed && (
        <section className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
          <h2 className="text-caption mb-3 uppercase tracking-wide text-zinc-500">
            {tUI("order.liveStatus")}
          </h2>
          <div className="space-y-0">
            {STEP_KEYS.map((step, idx) => {
              const done = stepIdx > idx;
              const current = order.status === step.key;
              const time = formatTime(order[step.field]);
              const statusLabel = tUI(`order.status.${step.key}`);
              const label =
                current && order.estimated_prep_minutes
                  ? `${statusLabel} (~${order.estimated_prep_minutes} min)`
                  : statusLabel;

              return (
                <div key={step.key} className="relative flex gap-3">
                  {current && statusPulse && !reduceMotion && (
                    <motion.div
                      initial={{ opacity: 0.4, scale: 0.8 }}
                      animate={{ opacity: 0, scale: 1.8 }}
                      transition={{ duration: 0.6 }}
                      className="absolute start-0 top-0 size-3 rounded-full bg-orange-500/30"
                    />
                  )}
                  <div className="flex flex-col items-center">
                    <div
                      className={`size-3 rounded-full ${
                        done
                          ? "bg-green-500"
                          : current
                            ? "pulse-dot bg-orange-500"
                            : "bg-zinc-700"
                      }`}
                    />
                    {idx < STEP_KEYS.length - 1 && (
                      <div
                        className={`my-1 min-h-5 w-0.5 flex-1 ${
                          done
                            ? "bg-green-500"
                            : "border-s border-dashed border-zinc-700"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pb-3">
                    <p
                      className={`text-sm font-medium ${
                        current
                          ? "text-orange-400"
                          : done
                            ? "text-zinc-200"
                            : "text-zinc-600"
                      }`}
                    >
                      <TypewriterText
                        text={label}
                        active={current && statusPulse}
                      />
                    </p>
                    {time && (
                      <p className="text-micro text-zinc-500">{time}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Collapsible order items */}
      <section className="mb-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80">
        <button
          type="button"
          onClick={() => setItemsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-start"
        >
          <div>
            <p className="text-sm font-medium text-zinc-200">{tUI("order.thisOrder")}</p>
            <p className="text-xs text-zinc-500">
              {tUI("order.itemCount", { count: order.order_items.length })} ·{" "}
              {formatPrice(Number(order.total), currency)}
            </p>
          </div>
          <ChevronDown
            className={`size-4 text-zinc-500 transition-transform ${
              itemsOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {itemsOpen && (
          <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
            {order.order_items.map((item, i) => (
              <div
                key={i}
                className="flex justify-between py-2 text-sm text-zinc-300"
              >
                <span>
                  {item.quantity}× {item.product_name}
                </span>
                <span className="tabular-nums">
                  {formatPrice(Number(item.total), currency)}
                </span>
              </div>
            ))}
            <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>{tUI("order.subtotal")}</span>
                <span>{formatPrice(Number(order.subtotal), currency)}</span>
              </div>
              {Number(order.tax_amount) > 0 && (
                <>
                  {(order.order_items?.length ?? 0) > 0 ? (
                    <TaxBreakdownLines
                      items={order.order_items.map((item) => ({
                        total: Number(item.total),
                        tax_rate: Number(item.tax_rate ?? 19),
                      }))}
                      currency={currency}
                      className="text-zinc-500"
                    />
                  ) : (
                    <div className="flex justify-between text-zinc-500">
                      <span>Tax ({Number(order.tax_percent)}%)</span>
                      <span>
                        {formatPrice(Number(order.tax_amount), currency)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            <TseReceiptBadge
              tseSignature={order.tse_signature ?? null}
              tseData={order.tse_data ?? null}
            />
          </div>
        )}
      </section>

      {/* Bill + payment — only when order is still active */}
      {!isClosed && (
        <section className="mb-6">
          <OrderBillPanel
            token={token}
            sessionToken={sessionToken}
            currency={currency}
            stripeOnboarded={stripeOnboarded}
            paymentOnlineEnabled={paymentOnlineEnabled}
            paymentAtBarEnabled={paymentAtBarEnabled}
            paymentCardAtTableEnabled={paymentCardAtTableEnabled}
            inPersonPaymentLocation={inPersonPaymentLocation}
            isPaid={isPaid}
            slug={slug}
            orderId={orderId}
            onPaid={() => {
              refreshOrder().then((data) => {
                if (data) setOrder(data);
              });
            }}
          />
        </section>
      )}

      {order.status === "delivered" && (
        <AiFeedbackPrompt
          orderId={orderId}
          sessionToken={sessionToken}
          deliveredAt={order.delivered_at}
          googleReviewUrl={googleReviewUrl}
        />
      )}

      {isCompleted && isPaid && order.beleg_token && (
        <section className="mb-6 flex justify-center">
          <a
            href={`/api/beleg/${order.beleg_token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Kassenbeleg ansehen
          </a>
        </section>
      )}

      {/* Actions */}
      <section className="flex flex-col gap-3">
        {!isClosed && (
          <CallWaiterButton
            token={token}
            tableName={order.tables?.name ?? "Table"}
          />
        )}
        {canAddMore && (
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-xl border-zinc-700 bg-transparent text-base font-semibold text-zinc-200 hover:bg-zinc-900"
          >
            <Link href={`/${slug}/${token}`}>{tUI("order.addMore")}</Link>
          </Button>
        )}
        {isRejected && (
          <Button
            asChild
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600"
          >
            <Link href={`/${slug}/${token}`}>{tUI("order.orderAgain")}</Link>
          </Button>
        )}
        {isCompleted && (
          <Button
            type="button"
            disabled={reordering}
            onClick={handleReorder}
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600 disabled:animate-pulse"
          >
            {tUI("order.orderAgain")}
          </Button>
        )}
      </section>
    </div>
  );
}
