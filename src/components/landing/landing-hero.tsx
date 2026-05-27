"use client";

import Link from "next/link";
import {
  HeroItem,
  HeroStagger,
  AnimateInView,
} from "@/components/landing/animate-in-view";
import { LandingFloorHero } from "@/components/landing/landing-floor-hero";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

function HeroAuroraOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-[10%] top-[8%] size-[420px] rounded-full bg-indigo-500/20 blur-[120px]" />
      <div className="absolute right-[5%] top-[18%] size-[360px] rounded-full bg-violet-500/12 blur-[120px]" />
      <div className="absolute bottom-[5%] left-[30%] size-[320px] rounded-full bg-indigo-400/10 blur-[120px]" />
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
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                Part of Vera Group
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="font-display text-[clamp(3rem,7vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-white">
                Denis
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-5 max-w-[540px] text-[17px] leading-relaxed text-zinc-300 sm:text-[18px]">
                Der Concierge für Ihren Gastraum.
              </p>
            </HeroItem>
            <HeroItem>
              <p className="mt-3 max-w-[540px] text-[15px] leading-relaxed text-zinc-500">
                Bestellung, Küchendisplay, Tischverwaltung, Kartenzahlung und
                DATEV-Export — ein System statt fünf.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  asChild
                  className="landing-btn-accent h-12 rounded-full px-8 text-sm font-semibold"
                >
                  <Link href="/signup">Kostenlos starten</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-[#2a2a3e] bg-transparent px-8 text-sm font-medium text-zinc-200 hover:bg-[#12121a] hover:text-white"
                >
                  <Link href="/skyline-lounge/demo-table-8">
                    Live-Demo ansehen →
                  </Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 text-[13px] leading-relaxed text-zinc-500">
                0 € / Monat · KassenSichV-konform · Live in unter 30 Minuten
              </p>
            </HeroItem>
          </HeroStagger>

          <AnimateInView className="relative lg:min-h-[460px]" delay={0.15}>
            <div className="aspect-[4/3] w-full lg:min-h-[460px]">
              <LandingFloorHero className="min-h-[280px] lg:min-h-[460px]" />
            </div>
          </AnimateInView>
        </div>
      </LandingContainer>
    </section>
  );
}
