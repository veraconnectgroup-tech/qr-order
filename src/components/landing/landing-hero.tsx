"use client";

import Link from "next/link";
import {
  HeroItem,
  HeroStagger,
} from "@/components/landing/animate-in-view";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-black pt-24 pb-16 md:pb-24">
      <LandingContainer wide className="relative z-[2]">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-16">
          <HeroStagger className="max-w-[560px]">
            <HeroItem>
              <p className="text-[12px] font-medium tracking-[0.08em] text-zinc-500">
                Part of Vera Group · Hospitality operating system
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="font-display text-[clamp(2.75rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                Run the floor. Serve faster. Stay compliant.
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-zinc-400 sm:text-[18px]">
                Denis is a modern hospitality OS — guest ordering, kitchen
                display, staff coordination, and payments in one calm enterprise
                platform. Intelligence embedded, not advertised.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  asChild
                  className="h-11 rounded-full bg-[var(--qr-ember)] px-7 text-sm font-semibold text-white hover:bg-[var(--qr-ember-hover)]"
                >
                  <Link href="/signup">Get started</Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  asChild
                  className="h-11 rounded-full px-6 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  <Link href="#features-guest">See the platform →</Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 text-[13px] text-zinc-600">
                €0 / month · KassenSichV · Live in under 30 minutes
              </p>
            </HeroItem>
          </HeroStagger>

          <LandingHeroVisual />
        </div>
      </LandingContainer>
    </section>
  );
}
