"use client";

import Link from "next/link";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import {
  HeroItem,
  HeroStagger,
} from "@/components/landing/animate-in-view";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { ScaledDashboardPreview } from "@/components/landing/scaled-dashboard-preview";
import { ShowcaseWindow } from "@/components/landing/showcase-frame";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="landing-hero-dark landing-dot-grid landing-glow-top relative overflow-hidden pt-[72px]">
      <LandingContainer wide className="relative pt-16 pb-8 sm:pt-20 sm:pb-12">
        <HeroStagger className="mx-auto max-w-[780px] text-center">
          <HeroItem>
            <h1 className="font-display text-[clamp(2.75rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-white">
              Your shortcut to every order.
            </h1>
          </HeroItem>
          <HeroItem>
            <p className="mx-auto mt-6 max-w-[540px] text-[17px] leading-relaxed text-zinc-400 sm:text-[18px]">
              A collection of powerful ordering tools — guest menus, live
              operations, kitchen flow, and payments — all within one platform.
              Fast, ergonomic, and reliable.
            </p>
          </HeroItem>
          <HeroItem>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="landing-btn-accent h-11 rounded-full px-7 text-sm font-semibold"
              >
                <Link href="/signup">Request access</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-11 rounded-full border-zinc-700 bg-transparent px-7 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:text-white"
              >
                <Link href="/skyline-lounge/demo-table-8">Live demo</Link>
              </Button>
            </div>
          </HeroItem>
          <HeroItem>
            <p className="mt-5 text-[13px] text-zinc-500">
              No guest app · Stripe Connect · Multi-location ready
            </p>
          </HeroItem>
        </HeroStagger>

        <div className="relative mx-auto mt-14 max-w-[920px] sm:mt-16 lg:mt-20">
          <div className="landing-hero-stage pointer-events-none absolute -inset-6 rounded-[2rem] sm:-inset-10" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-black p-3 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:p-4">
            <ShowcaseWindow
              url="app.qr-order.com/dashboard/orders"
              theme="dark"
              className="border-0 shadow-none ring-0"
            >
              <ScaledDashboardPreview designHeight={520}>
                <DashboardScreenShowcase
                  screen="orders"
                  variant="hero"
                  theme="dark"
                />
              </ScaledDashboardPreview>
            </ShowcaseWindow>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
