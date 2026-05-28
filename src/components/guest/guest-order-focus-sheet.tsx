"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { OrderBillPanel } from "@/components/guest/order-bill-panel";
import { formatPrice } from "@/lib/format";
import { orderStatusHeadlineKey } from "@/lib/i18n/translations";
import { orderStatusStepIndex } from "@/lib/orders/order-status-display";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import type { InPersonPaymentLocation } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";

type OrderData = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  total: number;
  estimated_prep_minutes: number | null;
  order_items: Array<{
    product_name: string;
    quantity: number;
    total: number;
  }>;
};

const STEP_KEYS = ["pending", "accepted", "preparing", "ready", "delivered"];

function shouldStopPolling(order: OrderData) {
  if (order.status === "delivered" || order.status === "rejected") {
    return isPaidPaymentStatus(order.payment_status);
  }
  return false;
}

export function GuestOrderFocusSheet({
  open,
  onOpenChange,
  orderId,
  slug,
  token,
  sessionToken,
  currency,
  stripeOnboarded,
  paymentOnlineEnabled,
  paymentAtBarEnabled,
  paymentCardAtTableEnabled,
  inPersonPaymentLocation = "bar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  slug: string;
  token: string;
  sessionToken: string;
  currency: string;
  stripeOnboarded: boolean;
  paymentOnlineEnabled: boolean;
  paymentAtBarEnabled: boolean;
  paymentCardAtTableEnabled: boolean;
  inPersonPaymentLocation?: InPersonPaymentLocation;
}) {
  const { tUI } = useAppLocale();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshOrder = useCallback(async () => {
    if (!orderId) return null;
    const res = await fetch(
      `/api/orders/${orderId}?sessionToken=${encodeURIComponent(sessionToken)}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as OrderData;
  }, [orderId, sessionToken]);

  useEffect(() => {
    if (!open || !orderId) {
      setOrder(null);
      return;
    }

    let cancelled = false;
    let pollId: number | null = null;

    async function load(initial = false) {
      if (initial) setLoading(true);
      const data = await refreshOrder();
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

    void load(true);
    pollId = window.setInterval(() => void load(false), REALTIME_FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, [open, orderId, refreshOrder]);

  const stepIdx = order ? orderStatusStepIndex(order.status) : 0;
  const isPaid = order ? isPaidPaymentStatus(order.payment_status) : false;
  const isClosed =
    order?.status === "delivered" ||
    order?.status === "rejected" ||
    order?.status === "cancelled";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,var(--denis-vv-height,100dvh))] overflow-y-auto rounded-t-2xl border-[var(--qr-elevated)] bg-[var(--qr-surface)] pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-start">
          <SheetTitle className="text-[var(--qr-ivory)]">
            {order
              ? `#${order.order_number}`
              : tUI("scene.situation.viewOrder")}
          </SheetTitle>
        </SheetHeader>

        {loading && !order ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-8 w-2/3 bg-[var(--qr-elevated)]" />
            <Skeleton className="h-24 w-full bg-[var(--qr-elevated)]" />
          </div>
        ) : null}

        {order ? (
          <div className="mt-4 space-y-5">
            <p className="text-sm text-[var(--qr-muted)]">
              {tUI(
                orderStatusHeadlineKey(order.status, order.payment_status) as "order.status.preparing"
              )}
              {order.estimated_prep_minutes && order.status === "preparing"
                ? ` · ~${order.estimated_prep_minutes} min`
                : null}
            </p>

            <div className="flex items-center justify-between gap-1">
              {STEP_KEYS.map((key, index) => {
                const active = index <= stepIdx;
                return (
                  <div
                    key={key}
                    className={`h-1.5 flex-1 rounded-full ${
                      active ? "bg-[var(--qr-ember)]" : "bg-[var(--qr-elevated)]"
                    }`}
                  />
                );
              })}
            </div>

            <ul className="divide-y divide-[var(--qr-elevated)] rounded-xl border border-[var(--qr-elevated)]">
              {order.order_items.map((item, index) => (
                <li
                  key={index}
                  className="flex justify-between gap-3 px-3 py-2.5 text-sm text-[var(--qr-ivory)]"
                >
                  <span>
                    {item.quantity}× {item.product_name}
                  </span>
                  <span className="tabular-nums text-[var(--qr-muted)]">
                    {formatPrice(Number(item.total), currency)}
                  </span>
                </li>
              ))}
            </ul>

            {!isClosed && !isPaid ? (
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
                orderId={order.id}
                onPaid={() => {
                  void refreshOrder().then((data) => {
                    if (data) setOrder(data);
                  });
                }}
              />
            ) : null}

            <Button
              asChild
              variant="outline"
              className="h-11 w-full rounded-xl border-[var(--qr-elevated)] bg-transparent text-[var(--qr-ivory)]"
            >
              <Link href={`/${slug}/${token}/order/${order.id}`}>
                {tUI("scene.situation.viewOrder")}
                <ChevronRight className="ms-1 size-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
