"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { FloorTile } from "@/components/design-system";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import type { CartItem } from "@/hooks/use-cart";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DenisCartHeaderLink({
  slug,
  token,
  taxPercent,
  currency,
  className,
}: {
  slug: string;
  token: string;
  taxPercent: number;
  currency: string;
  className?: string;
}) {
  const { tUI } = useAppLocale();
  const itemCount = useCart((s) => s.itemCount());
  const total = useCart((s) => s.total(false, taxPercent));

  if (itemCount === 0) return null;

  return (
    <Link
      href={`/${slug}/${token}/cart`}
      className={cn(
        "touch-target inline-flex max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-full border border-[var(--qr-ember)]/35 bg-[var(--qr-ember-muted)] px-2.5 py-1.5 text-[var(--qr-ivory)] transition hover:border-[var(--qr-ember)]/55 hover:bg-[var(--qr-ember)]/20 sm:max-w-none sm:px-3",
        className
      )}
      aria-label={tUI("a11y.cartSummary", {
        count: itemCount,
        total: formatPrice(total, currency),
      })}
    >
      <ShoppingBag className="size-4 shrink-0 text-[var(--qr-ember)]" aria-hidden />
      <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
        <span className="tabular-nums">{itemCount}</span>
        <span className="hidden sm:inline">
          {" · "}
          {tUI("cart.viewCart")}
        </span>
        <span className="sm:hidden"> · </span>
        <span className="tabular-nums">{formatPrice(total, currency)}</span>
      </span>
    </Link>
  );
}

export function DenisCartTiles({
  items,
  currency,
  title,
}: {
  items: CartItem[];
  currency: string;
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-[var(--qr-elevated)] px-3 py-2">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--qr-muted)]">
        {title}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <FloorTile
            key={`${item.productId}-${index}`}
            as="div"
            variant="kpi"
            compact
            label={item.productName}
            value={formatPrice(item.itemTotal, currency)}
            sublabel={`×${item.quantity}`}
            className="min-w-[7.5rem] shrink-0 snap-start"
          />
        ))}
      </div>
    </div>
  );
}
