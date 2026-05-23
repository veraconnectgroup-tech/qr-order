"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimateInView } from "@/components/landing/animate-in-view";
import { FeatureCheck } from "@/components/landing/feature-visuals";
import {
  LandingProductTabVisual,
  type ProductTabId,
} from "@/components/landing/landing-product-tab-visual";
import {
  LandingContainer,
  LandingHeadline,
  LandingLead,
  LandingSectionLabel,
} from "@/components/landing/landing-primitives";
import { cn } from "@/lib/utils";

const TAB_INTERVAL_MS = 6000;

const views: Array<{
  id: ProductTabId;
  label: string;
  title: string;
  bullets: string[];
}> = [
  {
    id: "guest",
    label: "Guest",
    title: "Ordering without friction",
    bullets: [
      "QR scan opens menu — no app download",
      "Modifiers, serve sizes, and live order status",
      "Session bill across multiple rounds",
      "Pay at table in under 15 seconds",
    ],
  },
  {
    id: "floor",
    label: "Floor",
    title: "Table operations",
    bullets: [
      "Zones, tables, and QR codes in one view",
      "Session totals and attention states",
      "Waiter calls from guest devices",
      "Staff assignments per table",
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    title: "Prep display",
    bullets: [
      "Four-column KDS: pending → ready",
      "Sound alerts for new orders",
      "Large tap targets for gloved hands",
      "Fullscreen mode for wall displays",
    ],
  },
  {
    id: "payments",
    label: "Payments",
    title: "Checkout per venue",
    bullets: [
      "Stripe Connect with Apple Pay & Google Pay",
      "Split bill by items or equal parts",
      "Digital tips at payment time",
      "Bar, counter, or table checkout",
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Operator reporting",
    bullets: [
      "Daily revenue and order volume KPIs",
      "Tips, feedback, and menu performance",
      "CSV export for finance teams",
      "DATEV-ready transaction records",
    ],
  },
];

export function LandingProductTabs() {
  const [active, setActive] = useState<ProductTabId>("guest");
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const current = views.find((v) => v.id === active) ?? views[0];
  const activeIndex = views.findIndex((v) => v.id === active);

  const selectTab = useCallback((id: ProductTabId) => {
    setActive(id);
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((prev: ProductTabId) => {
        const idx = views.findIndex((v) => v.id === prev);
        const next = views[(idx + 1) % views.length];
        return next.id;
      });
      setProgressKey((k) => k + 1);
    }, TAB_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, active]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setPaused(true);
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const next = views[(activeIndex + delta + views.length) % views.length];
      selectTab(next.id);
    }

    nav.addEventListener("keydown", onKeyDown);
    return () => nav.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, selectTab]);

  return (
    <section id="product" className="scroll-mt-24 border-t border-zinc-800 bg-zinc-950 py-16 text-white md:py-20">
      <LandingContainer wide>
        <AnimateInView className="mx-auto max-w-[640px] text-center">
          <LandingSectionLabel>Product tour</LandingSectionLabel>
          <LandingHeadline inverted className="mt-5">
            Built for every role on the floor
          </LandingHeadline>
          <LandingLead inverted className="mt-4">
            Guest ordering, live ops, kitchen sync, and payments — where your
            team already works.
          </LandingLead>
        </AnimateInView>

        <nav
          ref={navRef}
          tabIndex={0}
          className="mx-auto mt-10 flex max-w-[640px] flex-col items-center gap-3 outline-none"
          aria-label="Product views"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
          }}
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => {
                  setPaused(true);
                  selectTab(view.id);
                }}
                aria-current={active === view.id ? "true" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-[13px] font-medium transition",
                  active === view.id
                    ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(234,88,12,0.35)]"
                    : "border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                )}
              >
                {view.label}
              </button>
            ))}
          </div>
          <div className="h-0.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-800">
            {!paused && (
              <div
                key={`${active}-${progressKey}`}
                className="landing-tab-progress h-full rounded-full bg-orange-500"
                style={{ animationDuration: `${TAB_INTERVAL_MS}ms` }}
              />
            )}
          </div>
        </nav>

        <div className="relative mx-auto mt-12 max-w-[1080px] sm:mt-14">
          <div className="landing-diagonal-bars opacity-60" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="landing-diagonal-bar" />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 0.98, x: 24 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/80 shadow-[0_32px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            >
              <div className="grid lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]">
                <div className="flex flex-col justify-center border-b border-zinc-800 p-8 sm:p-10 lg:border-b-0 lg:border-r">
                  <p className="text-[12px] font-medium uppercase tracking-wider text-orange-500">
                    {current.label}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">
                    {current.title}
                  </h3>
                  <ul className="mt-6 space-y-3">
                    {current.bullets.map((bullet) => (
                      <FeatureCheck key={bullet} accent>
                        {bullet}
                      </FeatureCheck>
                    ))}
                  </ul>
                </div>
                <div className="landing-product-visual flex min-h-[380px] items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-8 sm:min-h-[460px] sm:p-10">
                  <div className="relative w-full max-w-[420px]">
                    <div
                      className="pointer-events-none absolute -inset-8 rounded-full bg-orange-500/10 blur-3xl"
                      aria-hidden
                    />
                    <div className="relative scale-[1.05] sm:scale-110">
                      <LandingProductTabVisual id={current.id} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </LandingContainer>
    </section>
  );
}
