"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { hapticSuccess } from "@/lib/haptics";
import { formatPrice } from "@/lib/format";
import { AnimatedOrderNumber } from "@/components/guest/animated-order-number";
import { CallWaiterButton } from "@/components/guest/call-waiter-button";
import { TypewriterText } from "@/components/guest/typewriter-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";

type OrderData = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
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
  order_items: Array<{
    product_name: string;
    quantity: number;
    total: number;
    notes: string | null;
    order_item_modifiers: Array<{ modifier_name: string }>;
  }>;
  tables: { name: string } | null;
};

const STEPS = [
  { key: "pending", label: "Received", field: "created_at" as const },
  { key: "accepted", label: "Accepted", field: "accepted_at" as const },
  { key: "preparing", label: "Preparing", field: "preparing_at" as const },
  { key: "ready", label: "Ready", field: "ready_at" as const },
  { key: "delivered", label: "Delivered", field: "delivered_at" as const },
];

const STATUS_ORDER = STEPS.map((s) => s.key);

const TERMINAL_STATUSES = new Set(["delivered", "rejected", "cancelled"]);

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderStatusTracker({
  slug,
  token,
  orderId,
  sessionToken,
  currency,
}: {
  slug: string;
  token: string;
  orderId: string;
  sessionToken: string;
  currency: string;
}) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const prevStatus = useRef<string | null>(null);
  const [statusPulse, setStatusPulse] = useState(false);
  const hapticFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    async function fetchOrder() {
      const res = await fetch(
        `/api/orders/${orderId}?sessionToken=${encodeURIComponent(sessionToken)}`
      );
      if (!res.ok || cancelled) return null;
      const json = await res.json();
      return json.data as OrderData;
    }

    async function refresh() {
      const data = await fetchOrder();
      if (!data || cancelled) return;
      setOrder(data);
      if (TERMINAL_STATUSES.has(data.status) && pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    }

    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });

    pollId = setInterval(refresh, REALTIME_FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, [orderId, sessionToken]);

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

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-6">
        <Skeleton className="mx-auto size-16 rounded-full bg-zinc-800" />
        <Skeleton className="mx-auto h-14 w-32 bg-zinc-800" />
        <Skeleton className="h-40 w-full bg-zinc-800" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 py-20 text-center text-zinc-400">
        Order not found.
      </div>
    );
  }

  const isRejected = order.status === "rejected";
  const isDelivered = order.status === "delivered";
  const canAddMore = !isRejected && !isDelivered;
  const currentIdx = STATUS_ORDER.indexOf(order.status);

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <div className="py-5 text-center sm:py-8">
        {isRejected ? (
          <XCircle className="mx-auto size-16 text-red-500" />
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <CheckCircle2 className="mx-auto size-16 text-green-500" />
          </motion.div>
        )}
        <h1 className="text-display mt-4 text-zinc-50">
          {isRejected
            ? "Order rejected"
            : order.payment_status === "paid"
              ? "Payment successful!"
              : "Order placed!"}
        </h1>
        {!isRejected && <AnimatedOrderNumber orderNumber={order.order_number} />}
        {isRejected && order.rejection_reason && (
          <p className="mt-2 text-body text-zinc-400">{order.rejection_reason}</p>
        )}
      </div>

      {!isRejected && (
        <div className="mb-8 rounded-xl bg-zinc-900 p-5">
          <h2 className="text-caption mb-4 uppercase tracking-wide text-zinc-500">
            Order status
          </h2>
          <div className="space-y-0">
            {STEPS.map((step, idx) => {
              const done = currentIdx > idx;
              const current = order.status === step.key;
              const time = formatTime(order[step.field]);
              const label =
                current && order.estimated_prep_minutes
                  ? `${step.label} (~${order.estimated_prep_minutes} min)`
                  : step.label;

              return (
                <div key={step.key} className="relative flex gap-3">
                  {current && statusPulse && (
                    <motion.div
                      initial={{ opacity: 0.4, scale: 0.8 }}
                      animate={{ opacity: 0, scale: 1.8 }}
                      transition={{ duration: 0.6 }}
                      className="absolute left-0 top-0 size-3 rounded-full bg-orange-500/30"
                    />
                  )}
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={
                        current && statusPulse
                          ? { scale: [1, 1.03, 1] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.6 }}
                      className={`size-3 rounded-full ${
                        done
                          ? "bg-green-500"
                          : current
                            ? "pulse-dot bg-orange-500"
                            : "bg-zinc-700"
                      }`}
                    />
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`my-1 min-h-6 w-0.5 flex-1 ${
                          done ? "bg-green-500" : "border-l border-dashed border-zinc-700"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pb-4">
                    <p
                      className={`text-sm font-medium ${
                        current
                          ? "text-orange-500"
                          : done
                            ? "text-zinc-200"
                            : "text-zinc-600"
                      }`}
                    >
                      <TypewriterText text={label} active={current && statusPulse} />
                    </p>
                    {time && (
                      <p className="text-micro text-zinc-500">{time}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-zinc-900 p-5">
        <h2 className="text-caption mb-3 uppercase tracking-wide text-zinc-500">
          Your order
        </h2>
        {order.order_items.map((item, i) => (
          <div key={i} className="border-b border-zinc-800 py-2 last:border-0">
            <div className="flex justify-between text-sm text-zinc-200">
              <span>
                {item.quantity}× {item.product_name}
              </span>
              <span className="tabular-nums">
                {formatPrice(Number(item.total), currency)}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatPrice(Number(order.subtotal), currency)}
            </span>
          </div>
          {Number(order.tax_amount) > 0 && (
            <div className="flex justify-between text-zinc-400">
              <span>Tax ({Number(order.tax_percent)}%)</span>
              <span className="tabular-nums">
                {formatPrice(Number(order.tax_amount), currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-1 font-bold text-zinc-50">
            <span>Total</span>
            <span className="tabular-nums">
              {formatPrice(Number(order.total), currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {!isRejected && (
          <CallWaiterButton
            token={token}
            tableName={order.tables?.name ?? "Table"}
          />
        )}
        {canAddMore && (
          <Button
            asChild
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600 sm:h-14"
          >
            <Link href={`/${slug}/${token}`}>Add more items</Link>
          </Button>
        )}
        {isRejected && (
          <Button
            asChild
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold hover:bg-orange-600 sm:h-14"
          >
            <Link href={`/${slug}/${token}`}>Order again</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
