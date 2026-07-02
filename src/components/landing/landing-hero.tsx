"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroDenisDemo } from "@/components/landing/landing-hero-denis-demo";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  const { copy } = useLandingCopy();
  const { hero } = copy;

  return (
    <section className="relative isolate grid h-[100dvh] min-h-[640px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[var(--lp-bg)]">
      {/* Copy — nimt-style centered stack on clean canvas */}
      <LandingContainer
        wide
        className="relative z-20 row-start-1 bg-[var(--lp-bg)] pt-[4.5rem] sm:pt-20 lg:pt-[5.25rem]"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgba(232,93,4,0.05),transparent_72%)]"
          aria-hidden
        />

        <HeroStagger className="relative mx-auto flex w-full max-w-[680px] flex-col items-center text-center">
          <HeroItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)] px-3 py-1 text-[12px] font-medium text-[var(--lp-muted)]">
              <Sparkles className="size-3.5 text-[var(--lp-ember)]" aria-hidden />
              {hero.eyebrow}
            </span>
          </HeroItem>

          <HeroItem>
            <h1 className="mt-5 font-display text-[clamp(2.625rem,6vw,4.125rem)] font-bold leading-[1.05] tracking-[-0.04em] text-[var(--lp-ink)] sm:mt-6">
              {hero.title}
              <span className="landing-serif-accent block pt-1 font-normal text-[var(--lp-ember)] [font-size:1.02em]">
                {hero.titleAccent}
              </span>
            </h1>
          </HeroItem>

          <HeroItem>
            <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-[1.6] text-[var(--lp-muted)] sm:mt-6 sm:text-[17px]">
              {hero.lead}
            </p>
          </HeroItem>

          <HeroItem>
            <div className="mt-7 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                asChild
                className="landing-btn-primary h-12 px-7 text-[15px] font-medium shadow-[0_12px_32px_rgba(22,20,14,0.2)] transition-transform hover:-translate-y-0.5"
              >
                <Link href="/signup">
                  {hero.cta}
                  <ArrowRight className="ms-1.5 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="landing-btn-secondary h-12 px-7 text-[15px] font-medium transition-transform hover:-translate-y-0.5"
              >
                <Link href="/skyline-lounge/demo-table-8">
                  <Play className="me-1.5 size-4" />
                  {hero.ctaSecondary}
                </Link>
              </Button>
            </div>
          </HeroItem>

          <HeroItem>
            <p className="mt-4 hidden text-[12px] text-[var(--lp-subtle)] min-[720px]:block sm:text-[13px]">
              {hero.meta}
            </p>
          </HeroItem>
        </HeroStagger>
      </LandingContainer>

      {/* Stage — terrace behind mockup; mockup docked to bottom edge (nimt) */}
      <div className="landing-hero-stage relative z-10 row-start-2 min-h-0">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Image
            src="/landing/hero-terrace.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[50%_72%]"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--lp-bg)] via-[var(--lp-bg)]/90 to-transparent sm:h-28"
            aria-hidden
          />
        </div>

        <div className="relative flex h-full min-h-0 items-end justify-center px-4 sm:px-6 lg:px-8">
          <div className="landing-hero-mockup-dock w-full max-w-[1080px]">
            <div className="overflow-hidden rounded-t-2xl border border-b-0 border-black/10 bg-white shadow-[0_-20px_80px_rgba(20,18,11,0.18)] sm:rounded-t-[1.35rem]">
              <LandingHeroDenisDemo frameless compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
