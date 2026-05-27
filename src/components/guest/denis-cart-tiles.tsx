"use client";

import { FloorTile } from "@/components/design-system";
import type { CartItem } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/format";

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
