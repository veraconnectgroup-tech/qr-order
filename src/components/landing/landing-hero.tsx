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
    <section className="relative overflow-hidden bg-[var(--lp-bg)] pt-16 md:pt-20">
      {/* Soft radial wash behind the headline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,93,4,0.06),transparent_70%)]"
        aria-hidden
      />

      <LandingContainer wide className="relative">
        <HeroStagger className="mx-auto flex w-full max-w-[760px] flex-col items-center text-center">
          <HeroItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--lp-muted)] shadow-[0_1px_2px_rgba(22,20,14,0.05)]">
              <Sparkles className="size-3.5 text-[var(--lp-ember)]" aria-hidden />
              {hero.eyebrow}
            </span>
          </HeroItem>

          <HeroItem>
            <h1 className="mt-4 font-display text-[clamp(2.25rem,5vw,3.375rem)] font-bold leading-[1.04] tracking-[-0.035em] text-[var(--lp-ink)]">
              {hero.title}
              <span className="landing-serif-accent block pt-1 font-normal text-[var(--lp-ember)] [font-size:1.04em]">
                {hero.titleAccent}
              </span>
            </h1>
          </HeroItem>

          <HeroItem>
            <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-[1.65] text-[var(--lp-muted)] sm:text-[16px]">
              {hero.lead}
            </p>
          </HeroItem>

          <HeroItem>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="landing-btn-primary h-12 px-7 text-[14.5px] font-medium shadow-[0_10px_30px_rgba(22,20,14,0.18)] transition-transform hover:-translate-y-0.5"
              >
                <Link href="/signup">
                  {hero.cta}
                  <ArrowRight className="ms-1.5 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="landing-btn-secondary h-12 px-7 text-[14.5px] font-medium transition-transform hover:-translate-y-0.5"
              >
                <Link href="/skyline-lounge/demo-table-8">
                  <Play className="me-1.5 size-4" />
                  {hero.ctaSecondary}
                </Link>
              </Button>
            </div>
          </HeroItem>

          <HeroItem>
            <p className="mt-4 text-[13px] text-[var(--lp-subtle)]">{hero.meta}</p>
          </HeroItem>
        </HeroStagger>
      </LandingContainer>

      {/* Full-bleed watercolor stage — product window floats over our painting */}
      <div className="relative mt-5 md:mt-6">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/landing/hero-terrace.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom"
            aria-hidden
          />
          {/* Blend the painting into the page top edge */}
          <div
            className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lp-bg)] to-transparent"
            aria-hidden
          />
        </div>

        <LandingContainer wide className="relative pt-4 pb-12 sm:pt-5 md:pt-6 md:pb-14">
          <div className="mx-auto max-w-[1140px] overflow-hidden rounded-xl ring-1 ring-black/10 shadow-[0_40px_110px_rgba(20,18,11,0.32)] sm:rounded-2xl">
            <LandingHeroDenisDemo frameless />
          </div>
        </LandingContainer>
      </div>
    </section>
  );
}
