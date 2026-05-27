"use client";

import Link from "next/link";
import type { CartItem } from "@/hooks/use-cart";
import { useAppLocale } from "@/components/guest/app-locale-provider";
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
        "touch-target shrink-0 text-xs tabular-nums text-[var(--qr-muted)] transition hover:text-[var(--qr-ivory)] sm:text-sm",
        className
      )}
      aria-label={tUI("a11y.cartSummary", {
        count: itemCount,
        total: formatPrice(total, currency),
      })}
    >
      {itemCount} · {formatPrice(total, currency)}
    </Link>
  );
}

/** @deprecated Cart summary lives in header link only. */
export function DenisCartTiles(_props: {
  items: CartItem[];
  currency: string;
  title: string;
}) {
  return null;
}
