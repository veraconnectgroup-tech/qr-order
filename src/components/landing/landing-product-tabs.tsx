"use client";

import { useState } from "react";
import { AnimateInView } from "@/components/landing/animate-in-view";
import {
  CheckoutShowcase,
  GuestMenuShowcase,
  HistoryShowcase,
  KitchenShowcase,
  TablesShowcase,
} from "@/components/landing/product-showcases";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
  LandingSectionLabel,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const views = [
  {
    id: "guest",
    label: "Guest menu",
    title: "Ordering without friction",
    description:
      "Mobile-native menus with modifiers and live order status. Guests scan a QR code — no download required.",
    visual: <GuestMenuShowcase />,
  },
  {
    id: "floor",
    label: "Floor",
    title: "Table operations",
    description:
      "Zones, QR codes, session totals, and attention states on a single view your hosts can act on.",
    visual: <TablesShowcase />,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    title: "Prep display",
    description:
      "Accepted orders on the line with timers and large tap targets for peak service.",
    visual: <KitchenShowcase />,
  },
  {
    id: "payments",
    label: "Payments",
    title: "Checkout per venue",
    description:
      "Stripe Connect, session bills, bar or table checkout — configured to your service model.",
    visual: <CheckoutShowcase />,
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Operator reporting",
    description:
      "Daily revenue, filters, and CSV export — ready for GMs, owners, and finance teams.",
    visual: <HistoryShowcase />,
  },
] as const;

export function LandingProductTabs() {
  const [active, setActive] = useState<(typeof views)[number]["id"]>("guest");
  const current = views.find((v) => v.id === active) ?? views[0];

  return (
    <section id="product" className="scroll-mt-24 border-t border-zinc-800 bg-zinc-950 py-20 text-white sm:py-28">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingSectionLabel>Real-time ops</LandingSectionLabel>
          <LandingHeadline inverted className="mt-5">
            Your floor just got smarter.
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            Live orders, kitchen sync, payment requests, and table sessions —
            where your team already works.
          </LandingLead>
        </AnimateInView>

        <div className="relative mx-auto mt-14 max-w-[980px] sm:mt-16">
          <div className="landing-diagonal-bars" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="landing-diagonal-bar" />
            ))}
          </div>

          <AnimateInView key={current.id} className="relative">
            <div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/80 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="grid lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
                <div className="flex flex-col justify-center border-b border-zinc-800 p-8 sm:p-10 lg:border-b-0 lg:border-r">
                  <p className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">
                    {current.label}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
                    {current.title}
                  </h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                    {current.description}
                  </p>
                </div>
                <div className="flex min-h-[340px] items-center justify-center bg-black/40 p-6 sm:min-h-[400px] sm:p-8">
                  {current.visual}
                </div>
              </div>
            </div>
          </AnimateInView>

          <nav
            className="relative mt-10 flex items-center justify-center gap-3 sm:gap-4"
            aria-label="Product views"
          >
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActive(view.id)}
                aria-label={view.label}
                aria-current={active === view.id ? "true" : undefined}
                className="flex h-8 items-center px-1"
              >
                <span
                  className={cn(
                    "landing-tab-indicator",
                    active === view.id && "landing-tab-indicator-active"
                  )}
                />
              </button>
            ))}
          </nav>
        </div>
      </LandingContainer>
    </section>
  );
}
