"use client";

import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { OrdersBoardContent } from "@/components/landing/showcase-content";
import { ScaledDashboardPreview } from "@/components/landing/scaled-dashboard-preview";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";

export function AuthShowcasePanel() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between bg-[var(--qr-void)] px-10 py-12 lg:px-14 lg:py-16">
      <div>
        <DenisBrandMark markSize={32} />
        <h2 className="mt-8 max-w-sm text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Fast ordering & payment for hospitality
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          QR scan to order and pay. Staff dashboard, kitchen display, and Denis
          AI concierge — one platform.
        </p>
      </div>

      <div className="mt-10 w-full max-w-xl">
        <ShowcaseWindow url="app.denis.io/dashboard/orders" className="w-full">
          <ScaledDashboardPreview designHeight={400}>
            <OrdersBoardContent variant="feature" theme="dark" />
          </ScaledDashboardPreview>
        </ShowcaseWindow>
      </div>
    </div>
  );
}
