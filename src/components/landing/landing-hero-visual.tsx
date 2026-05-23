"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DashboardScreenShowcase } from "@/components/landing/dashboard-screen-showcase";
import { HeroFloat, HeroGlow, HeroSlideIn } from "@/components/landing/hero-motion";
import { GuestMenuContent } from "@/components/landing/showcase-content";
import { ScaledDashboardPreview } from "@/components/landing/scaled-dashboard-preview";
import { ScaledPhonePreview } from "@/components/landing/scaled-phone-preview";
import {
  ShowcasePhone,
  ShowcaseStage,
  ShowcaseWindow,
} from "@/components/landing/showcase-frame";

export function LandingHeroVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
      {/* Mobile: stacked preview */}
      <motion.div
        className="relative lg:hidden"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="landing-hero-stage pointer-events-none absolute -inset-8 rounded-[2rem]" aria-hidden />
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-black p-2 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <ShowcaseWindow
            url="app.qr-order.com/dashboard"
            theme="dark"
            className="border-0 shadow-none ring-0"
          >
            <ScaledDashboardPreview designHeight={420}>
              <DashboardScreenShowcase screen="orders" variant="hero" theme="dark" />
            </ScaledDashboardPreview>
          </ShowcaseWindow>
        </div>
        <HeroFloat delay={0.35} className="absolute -bottom-6 -left-2 z-10 w-[38%] min-w-[120px] max-w-[160px]">
          <ShowcasePhone hideLabel className="max-w-none shadow-[0_20px_48px_rgba(0,0,0,0.75)]">
            <ScaledPhonePreview designHeight={480}>
              <GuestMenuContent variant="hero" />
            </ScaledPhonePreview>
          </ShowcasePhone>
        </HeroFloat>
      </motion.div>

      {/* Desktop: layered stage */}
      <ShowcaseStage className="hidden lg:block lg:max-w-[720px] xl:max-w-[780px]">
        <HeroGlow className="left-[8%] top-[20%] size-[320px] bg-orange-500/[0.12]" />
        <HeroGlow className="right-[12%] bottom-[10%] size-[240px] bg-orange-500/[0.06]" />

        {/* Reflection */}
        {!reduce && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[10%] bottom-[-8%] h-[40%] rounded-[50%] bg-gradient-to-t from-orange-500/10 via-orange-500/5 to-transparent blur-2xl"
          />
        )}

        <HeroSlideIn from="right" delay={0.12} className="absolute right-0 top-[2%] z-10 w-[88%]">
          <div className="landing-hero-reflection relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-black p-1 shadow-[0_32px_100px_rgba(0,0,0,0.75)]">
            <ShowcaseWindow
              url="app.qr-order.com/dashboard/orders"
              theme="dark"
              className="border-0 shadow-none ring-0"
            >
              <ScaledDashboardPreview designHeight={480}>
                <DashboardScreenShowcase screen="orders" variant="hero" theme="dark" />
              </ScaledDashboardPreview>
            </ShowcaseWindow>
          </div>
        </HeroSlideIn>

        <HeroFloat
          delay={0.28}
          className="absolute bottom-[6%] left-[-4%] z-30 w-[36%] min-w-[170px] max-w-[220px]"
        >
          <ShowcasePhone
            hideLabel
            className="max-w-none shadow-[0_24px_64px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.06]"
          >
            <ScaledPhonePreview designHeight={540}>
              <GuestMenuContent variant="hero" />
            </ScaledPhonePreview>
          </ShowcasePhone>
        </HeroFloat>
      </ShowcaseStage>
    </div>
  );
}
