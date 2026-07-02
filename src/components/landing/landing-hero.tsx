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
    <section className="relative flex h-[100dvh] min-h-[640px] flex-col overflow-hidden bg-[var(--lp-bg)]">
      {/* Copy block — clean page bg, no terrace art behind */}
      <LandingContainer wide className="relative shrink-0 pt-14 pb-1 sm:pt-16 md:pt-[4.25rem]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgba(232,93,4,0.06),transparent_70%)]"
          aria-hidden
        />

        <HeroStagger className="relative mx-auto flex w-full max-w-[720px] flex-col items-center text-center">
          <HeroItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)] px-3 py-1 text-[12px] font-medium text-[var(--lp-muted)] shadow-[0_1px_2px_rgba(22,20,14,0.05)]">
              <Sparkles className="size-3.5 text-[var(--lp-ember)]" aria-hidden />
              {hero.eyebrow}
            </span>
          </HeroItem>

          <HeroItem>
            <h1 className="mt-3 font-display text-[clamp(2rem,4.6vw,3.125rem)] font-bold leading-[1.04] tracking-[-0.035em] text-[var(--lp-ink)]">
              {hero.title}
              <span className="landing-serif-accent block pt-0.5 font-normal text-[var(--lp-ember)] [font-size:1.04em]">
                {hero.titleAccent}
              </span>
            </h1>
          </HeroItem>

          <HeroItem>
            <p className="mx-auto mt-3 max-w-[540px] text-[14px] leading-[1.6] text-[var(--lp-muted)] sm:text-[15px]">
              {hero.lead}
            </p>
          </HeroItem>

          <HeroItem>
            <div className="mt-4 flex flex-col items-center gap-2.5 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="landing-btn-primary h-11 px-6 text-[14px] font-medium shadow-[0_10px_30px_rgba(22,20,14,0.18)] transition-transform hover:-translate-y-0.5"
              >
                <Link href="/signup">
                  {hero.cta}
                  <ArrowRight className="ms-1.5 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="landing-btn-secondary h-11 px-6 text-[14px] font-medium transition-transform hover:-translate-y-0.5"
              >
                <Link href="/skyline-lounge/demo-table-8">
                  <Play className="me-1.5 size-4" />
                  {hero.ctaSecondary}
                </Link>
              </Button>
            </div>
          </HeroItem>

          <HeroItem>
            <p className="mt-3 text-[12.5px] text-[var(--lp-subtle)]">{hero.meta}</p>
          </HeroItem>
        </HeroStagger>
      </LandingContainer>

      {/* Terrace stage — background only behind the mockup rail */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/landing/hero-terrace.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[50%_92%]"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--lp-bg)] via-[var(--lp-bg)]/92 to-transparent sm:h-28"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--lp-bg)]/80 to-transparent"
            aria-hidden
          />
        </div>

        <LandingContainer wide className="relative flex h-full min-h-0 items-end justify-center pb-2 sm:pb-3 md:pb-4">
          <div className="landing-hero-mockup-scale w-full max-w-[1140px] origin-bottom">
            <div className="overflow-hidden rounded-xl ring-1 ring-black/10 shadow-[0_32px_90px_rgba(20,18,11,0.28)] sm:rounded-2xl">
              <LandingHeroDenisDemo frameless />
            </div>
          </div>
        </LandingContainer>
      </div>
    </section>
  );
}
