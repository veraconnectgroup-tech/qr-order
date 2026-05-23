"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { LanguageSelector } from "@/components/guest/language-selector";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";
import { formatPrice } from "@/lib/format";
import { formatServeSize } from "@/lib/serve-size";
import { QuantitySelector } from "@/components/guest/quantity-selector";
import { Button } from "@/components/ui/button";

function EmptyCartState({ slug, token }: { slug: string; token: string }) {
  const { tUI } = useAppLocale();
  const sessionToken = useGuestSession((s) => s.sessionToken);
  const [activeOrder, setActiveOrder] = useState<{
    id: string;
    order_number: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    fetch(
      `/api/sessions/bill?sessionToken=${encodeURIComponent(sessionToken)}&tableToken=${encodeURIComponent(token)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.data?.orders?.length) return;
        const open = json.data.orders.filter(
          (o: { status: string }) =>
            o.status !== "rejected" && o.status !== "cancelled"
        );
        if (open.length) setActiveOrder(open[open.length - 1]);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [sessionToken, token]);

  return (
    <div className="min-h-dvh px-4 pb-safe pt-4">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href={`/${slug}/${token}`}
          className="touch-target inline-flex items-center text-zinc-400"
        >
          ← {tUI("common.back")}
        </Link>
        <h1 className="min-w-0 flex-1 text-heading text-zinc-50">{tUI("cart.title")}</h1>
        <LanguageSelector compact />
      </header>
      <div className="py-16 text-center sm:py-20">
        {activeOrder ? (
          <>
            <p className="text-heading text-zinc-50">{tUI("cart.emptyActive")}</p>
            <p className="mt-2 text-body text-zinc-400">
              {tUI("cart.emptyActiveHint", {
                orderNumber: activeOrder.order_number,
              })}
            </p>
            <Button
              asChild
              className="mt-6 h-12 bg-orange-500 hover:bg-orange-600"
            >
              <Link href={`/${slug}/${token}/order/${activeOrder.id}`}>
                {tUI("cart.trackOrder")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-heading text-zinc-50">{tUI("cart.empty")}</p>
            <p className="mt-2 text-body text-zinc-400">{tUI("cart.emptyHint")}</p>
            <Button
              asChild
              className="mt-6 h-12 bg-orange-500 hover:bg-orange-600"
            >
              <Link href={`/${slug}/${token}`}>{tUI("cart.viewMenu")}</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function CartView({
  slug,
  token,
  orgName,
  tableName,
  taxPercent,
  currency,
  orderingEnabled = true,
}: {
  slug: string;
  token: string;
  orgName: string;
  tableName: string;
  taxPercent: number;
  currency: string;
  orderingEnabled?: boolean;
}) {
  const { tUI } = useAppLocale();
  const items = useCart((s) => s.items);
  const removeItem = useCart((s) => s.removeItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const subtotal = useCart((s) => s.subtotal());
  const taxAmount = useCart((s) => s.taxAmount(false, taxPercent));
  const total = useCart((s) => s.total(false, taxPercent));

  if (!items.length) {
    return <EmptyCartState slug={slug} token={token} />;
  }

  return (
    <>
      <div className="min-h-dvh px-4 pb-checkout-offset pt-4">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href={`/${slug}/${token}`}
            className="touch-target inline-flex items-center text-zinc-400"
          >
            ← {tUI("common.back")}
          </Link>
          <h1 className="min-w-0 flex-1 text-heading text-zinc-50">{tUI("cart.title")}</h1>
          <LanguageSelector compact />
        </header>

        <p className="text-caption mb-4 text-zinc-500">
          {tableName} · {orgName}
        </p>

        {!orderingEnabled && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {tUI("cart.orderingPaused")}
          </div>
        )}

        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {items.map((item, index) => (
            <motion.div
              key={`${item.productId}-${index}`}
              layout
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
              className="rounded-xl bg-zinc-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-title text-zinc-50">{item.productName}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-caption mt-1 text-zinc-400">
                      {item.modifiers.map((m) => m.modifierName).join(", ")}
                    </p>
                  )}
                  {item.serveSize && (
                    <p className="text-caption mt-1 text-zinc-400">
                      {tUI("cart.serve")}: {formatServeSize(item.serveSize)}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-caption mt-1 italic text-zinc-500">
                      {item.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="touch-target inline-flex shrink-0 items-center justify-center text-zinc-500 hover:text-red-400"
                  aria-label={tUI("common.remove")}
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <QuantitySelector
                  value={item.quantity}
                  onChange={(q) => updateQuantity(index, q)}
                />
                <span className="text-price shrink-0 text-zinc-50">
                  {formatPrice(item.itemTotal, currency)}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <Link
          href={`/${slug}/${token}`}
          className="mt-4 block rounded-xl border border-dashed border-zinc-700 p-4 text-center text-sm font-medium text-orange-500 touch-manipulation active:bg-zinc-900/50"
        >
          {tUI("cart.addMore")}
        </Link>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-safe backdrop-blur-sm">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-zinc-400">
            <span>{tUI("cart.subtotal")}</span>
            <span className="tabular-nums">{formatPrice(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>{tUI("cart.tax", { percent: taxPercent })}</span>
            <span className="tabular-nums">{formatPrice(taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-800 pt-2 font-semibold text-zinc-50">
            <span>{tUI("cart.total")}</span>
            <span className="text-lg font-bold tabular-nums">
              {formatPrice(total, currency)}
            </span>
          </div>
        </div>

        {orderingEnabled ? (
          <Button
            asChild
            className="mt-3 h-12 w-full rounded-xl bg-orange-500 text-base font-bold hover:bg-orange-600"
          >
            <Link href={`/${slug}/${token}/checkout`}>{tUI("cart.checkout")}</Link>
          </Button>
        ) : (
          <Button disabled className="mt-3 h-12 w-full rounded-xl text-base font-bold">
            {tUI("cart.checkoutUnavailable")}
          </Button>
        )}
      </div>
    </>
  );
}
