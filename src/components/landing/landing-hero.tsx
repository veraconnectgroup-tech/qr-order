"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  HeroItem,
  HeroStagger,
  AnimateInView,
} from "@/components/landing/animate-in-view";
import { HeroWordRotation } from "@/components/landing/hero-word-rotation";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

const LandingHeroVisual = dynamic(
  () =>
    import("@/components/landing/landing-hero-visual").then((m) => ({
      default: m.LandingHeroVisual,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-[4/3] w-full animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60 lg:min-h-[460px]"
        aria-hidden
      />
    ),
  }
);

function HeroAuroraOrbs() {
  const reduce = useReducedMotion();

  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[10%] top-[8%] size-[420px] rounded-full bg-orange-500/25 blur-[120px]"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[5%] top-[18%] size-[360px] rounded-full bg-amber-400/15 blur-[120px]"
        animate={{ x: [0, -35, 25, 0], y: [0, 25, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[5%] left-[30%] size-[320px] rounded-full bg-rose-500/10 blur-[120px]"
        animate={{ x: [0, 30, -25, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="landing-hero-dark landing-dot-grid landing-glow-top relative overflow-hidden pt-20 pb-12">
      <HeroAuroraOrbs />
      <LandingContainer wide className="relative z-[2]">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 xl:gap-16">
          <HeroStagger className="max-w-[620px] lg:max-w-none">
            <HeroItem>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-500">
                Hospitality OS
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="font-display text-[clamp(2.5rem,5.5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                <span className="landing-gradient-text">
                  The operating system for modern hospitality.
                </span>
              </h1>
            </HeroItem>
            <HeroItem>
              <HeroWordRotation />
            </HeroItem>
            <HeroItem>
              <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-zinc-400 sm:text-[18px]">
                QR ordering, live kitchen ops, table management, and Stripe
                payments — unified in one platform.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  asChild
                  className="landing-btn-accent h-12 rounded-full px-8 text-sm font-semibold"
                >
                  <Link href="/signup">Start free</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-zinc-700 bg-transparent px-8 text-sm font-medium text-zinc-200 hover:bg-zinc-900 hover:text-white"
                >
                  <Link href="/skyline-lounge/demo-table-8">
                    See live demo →
                  </Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 text-[13px] leading-relaxed text-zinc-500">
                Used by early operators across Germany · 0€/month · Live in{" "}
                <span className="text-zinc-400">&lt; 30 min</span>
              </p>
            </HeroItem>
          </HeroStagger>

          <AnimateInView className="relative lg:min-h-[460px]" delay={0.15}>
            <LandingHeroVisual />
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
