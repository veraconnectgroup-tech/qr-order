"use client";

import Link from "next/link";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="bg-black pt-28 pb-20 md:pt-36 md:pb-28">
      <LandingContainer wide>
        <div className="grid items-center gap-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <HeroStagger className="max-w-[520px]">
            <HeroItem>
              <p className="text-[13px] tracking-wide text-zinc-600">
                Denis · Part of Vera Group
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="font-display text-[clamp(2.5rem,5.5vw,4rem)] font-medium leading-[1.05] tracking-[-0.03em] text-white">
                Hospitality operations,
                <span className="text-zinc-500"> one system.</span>
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-8 max-w-[460px] text-[17px] leading-[1.75] text-zinc-500">
                Guest ordering, kitchen, staff coordination, and payments —
                designed for the floor, not for demos.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-10">
                <Button
                  size="lg"
                  asChild
                  className="h-11 rounded-md bg-[var(--qr-ember)] px-8 text-sm font-medium text-white hover:bg-[var(--qr-ember-hover)]"
                >
                  <Link href="/signup">Get started</Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <p className="mt-8 text-[13px] text-zinc-600">
                €0 / month · KassenSichV · Under 30 minutes to live
              </p>
            </HeroItem>
          </HeroStagger>

          <LandingHeroVisual />
        </div>
      </LandingContainer>
    </section>
  );
}
