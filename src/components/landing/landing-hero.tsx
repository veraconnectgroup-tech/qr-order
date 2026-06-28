"use client";

import Link from "next/link";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroDenisDemo } from "@/components/landing/landing-hero-denis-demo";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  const { copy } = useLandingCopy();
  const { hero } = copy;

  return (
    <section className="overflow-hidden bg-black pt-32 pb-16 md:pt-36 md:pb-20">
      <LandingContainer wide>
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
          <HeroStagger className="w-full max-w-[540px] shrink-0 lg:max-w-[480px] xl:max-w-[520px]">
            <HeroItem>
              <p className="text-[13px] tracking-wide text-zinc-600">
                {hero.eyebrow}
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="mt-4 font-display text-[clamp(2.25rem,4.8vw,3.75rem)] font-medium leading-[1.08] tracking-[-0.03em] text-white">
                {hero.title}
                <span className="text-zinc-400">{hero.titleAccent}</span>
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 max-w-[460px] text-[17px] leading-[1.75] text-zinc-500">
                {hero.lead}
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="h-12 rounded-full bg-[var(--qr-ember)] px-8 text-sm font-semibold text-white hover:bg-[var(--qr-ember-hover)]"
                >
                  <Link href="/signup">{hero.cta}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-white/[0.12] bg-transparent px-8 text-sm text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                >
                  <Link href="/skyline-lounge/demo-table-8">{hero.ctaSecondary}</Link>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 text-[13px] text-zinc-600">{hero.meta}</p>
            </HeroItem>
          </HeroStagger>

          <div className="w-full min-w-0 lg:flex-1">
            <LandingHeroDenisDemo />
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
