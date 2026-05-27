"use client";

import Link from "next/link";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="overflow-hidden bg-black pt-32 pb-16 md:pt-36 md:pb-20">
      <LandingContainer wide>
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
          <HeroStagger className="w-full max-w-[540px] shrink-0 lg:max-w-[480px] xl:max-w-[520px]">
            <HeroItem>
              <p className="text-[13px] tracking-wide text-zinc-600">
                Denis · Part of Vera Group
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="mt-4 font-display text-[clamp(2.25rem,4.8vw,3.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-white">
                Hospitality operations,
                <span className="text-zinc-500"> one system.</span>
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 max-w-[460px] text-[17px] leading-[1.75] text-zinc-500">
                Guest ordering, kitchen, staff coordination, and payments —
                designed for the floor, not for demos.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8">
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
              <p className="mt-6 text-[13px] text-zinc-600">
                €0 / month · KassenSichV · Under 30 minutes to live
              </p>
            </HeroItem>
          </HeroStagger>

          <div className="w-full min-w-0 lg:flex-1">
            <LandingHeroVisual />
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
