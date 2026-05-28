"use client";

import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";

export function AuthShowcasePanel() {
  return (
    <div className="relative flex h-full w-full flex-col justify-center bg-[var(--qr-void)] px-10 py-12 lg:px-14 lg:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_40%,rgba(249,115,22,0.08),transparent_60%)]"
      />
      <div className="relative max-w-sm">
        <DenisBrandMark markSize={32} />
        <h2 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Fast ordering & payment for hospitality
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          QR scan to order and pay. Staff dashboard, kitchen display, and Denis
          AI concierge — one platform.
        </p>
      </div>
    </div>
  );
}
