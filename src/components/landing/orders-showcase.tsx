"use client";

import { ShowcaseTablet } from "@/components/landing/showcase-frame";
import { OrdersBoardContent } from "@/components/landing/showcase-content";

export function OrdersShowcase({ compact = false }: { compact?: boolean }) {
  return (
    <ShowcaseTablet
      url="denis.app/orders"
      hideCaption
      theme="light"
    >
      <OrdersBoardContent
        variant={compact ? "hero" : "feature"}
        theme="light"
      />
    </ShowcaseTablet>
  );
}
