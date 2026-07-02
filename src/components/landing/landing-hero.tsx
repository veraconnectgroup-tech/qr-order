"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroDenisDemo } from "@/components/landing/landing-hero-denis-demo";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  const { copy } = useLandingCopy();
  const { hero } = copy;

  return (
    <section className="relative overflow-hidden bg-[var(--lp-bg)] pt-28 pb-16 md:pt-36 md:pb-20">
      <LandingContainer wide>
        <HeroStagger className="w-full max-w-[640px]">
          <HeroItem>
            <p className="text-[13px] font-medium text-[var(--lp-muted)]">
              {hero.eyebrow}
            </p>
          </HeroItem>
          <HeroItem>
            <h1 className="mt-4 font-display text-4xl font-medium leading-[1.15] tracking-[-0.02em] text-[var(--lp-ink)] sm:text-5xl">
              {hero.title}
              <span className="text-[var(--lp-muted)]">{hero.titleAccent}</span>
            </h1>
          </HeroItem>
          <HeroItem>
            <p className="mt-5 max-w-[540px] text-[16px] leading-[1.7] text-[var(--lp-muted)]">
              {hero.lead}
            </p>
          </HeroItem>
          <HeroItem>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="landing-btn-primary h-11 px-6 text-[14px] font-medium"
              >
                <Link href="/signup">
                  {hero.cta}
                  <ArrowRight className="ms-1.5 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="landing-btn-secondary h-11 px-6 text-[14px] font-medium"
              >
                <Link href="/skyline-lounge/demo-table-8">
                  <Play className="me-1.5 size-4" />
                  {hero.ctaSecondary}
                </Link>
              </Button>
            </div>
          </HeroItem>
          <HeroItem>
            <p className="mt-5 text-[13px] text-[var(--lp-subtle)]">{hero.meta}</p>
          </HeroItem>
        </HeroStagger>
      </LandingContainer>

      <LandingContainer wide className="mt-12 md:mt-16">
        {/* Cursor-style stage: watercolor painting as backdrop, product window on top */}
        <div className="relative overflow-hidden rounded-xl border border-[var(--lp-border)] sm:rounded-2xl">
          <Image
            src="/landing/hero-watercolor.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1280px) 1232px, 100vw"
            className="object-cover"
            aria-hidden
          />
          <div className="relative p-4 sm:p-10 md:p-16 lg:px-24 lg:py-20">
            <div className="mx-auto max-w-[920px] overflow-hidden rounded-lg shadow-[0_32px_90px_rgba(20,18,11,0.4)] sm:rounded-xl">
              <LandingHeroDenisDemo frameless />
            </div>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
