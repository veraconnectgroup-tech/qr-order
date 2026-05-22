"use client";

import { ShowcaseTablet } from "@/components/landing/showcase-frame";
import { OrdersBoardContent } from "@/components/landing/showcase-content";

export function OrdersShowcase({ compact = false }: { compact?: boolean }) {
  return (
    <ShowcaseTablet
      url="dashboard.qrorder.app/orders"
      label="Staff tablet — live orders"
      shortLabel="Staff — orders"
    >
      <OrdersBoardContent variant={compact ? "hero" : "feature"} />
    </ShowcaseTablet>
  );
}
