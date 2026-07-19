"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroDenisDemo } from "@/components/landing/landing-hero-denis-demo";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { Button } from "@/components/ui/button";
import { DenisVoiceOrb } from "@/components/denis-voice-orb";

/**
 * NIMT-style hero: copy first, product window second, atmosphere behind it.
 * Product is the signal; the terrace image is only a hospitality cue.
 */
export function LandingHero() {
  const { copy } = useLandingCopy();
  const { hero } = copy;

  return (
    <section className="landing-hero relative flex min-h-[100dvh] overflow-hidden border-b border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] pb-8 pt-[5.25rem] sm:pb-10 sm:pt-[5.75rem] lg:pt-20">
      <div
        className="landing-hero-media pointer-events-none absolute inset-x-0 bottom-0 top-[39%] z-0 sm:top-[38%] lg:top-[37%]"
        aria-hidden
      >
        <Image
          src="/landing/hero-terrace.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_78%]"
        />
        <div className="landing-hero-wash absolute inset-0" />
      </div>

      {/* Floating live-demo pill, retell-style corner placement — same
          black-circle-with-particles orb visual as the kitchen feature
          row (StationVoiceShowcase), shrunk down and reused here rather
          than a second, separate visual built from scratch. Plain
          circle here, not the liquid-blob morph — founder confirmed
          only the black/particle color treatment needs to carry over,
          not the animated shape (too small at this size to read well
          anyway). */}
      <Link
        href="/skyline-lounge/demo-table-8"
        className="group absolute bottom-5 right-5 z-20 flex items-center gap-3 rounded-2xl border border-black/10 bg-white/95 px-4 py-2.5 shadow-[0_18px_50px_-20px_rgba(22,20,14,0.35)] backdrop-blur transition-transform hover:-translate-y-0.5 sm:bottom-8 sm:right-8 sm:px-5 sm:py-3"
      >
        <span className="text-left text-[12px] font-semibold leading-tight text-[var(--lp-ink)] sm:text-[13px]">
          {hero.ctaSecondary}
        </span>
        <span className="relative flex size-11 shrink-0 items-center justify-center sm:size-12">
          <span className="absolute inset-0 rounded-full bg-black" aria-hidden />
          <DenisVoiceOrb size={44} />
        </span>
      </Link>

      <LandingContainer wide className="relative z-10 flex flex-1 flex-col">
        <HeroStagger className="mx-auto flex min-h-0 w-full max-w-[660px] flex-1 flex-col items-center justify-center pb-7 text-center sm:pb-8 lg:pb-10">
          <HeroItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)]/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lp-muted)]">
              <span className="size-1.5 rounded-full bg-[var(--lp-ember)]" aria-hidden />
              {hero.eyebrow}
            </span>
          </HeroItem>

          <HeroItem>
            <h1 className="mt-3 font-display text-[clamp(2.15rem,4.7vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--lp-ink)] sm:mt-4">
              {hero.title}
              <span className="landing-serif-accent block pt-1 font-normal text-[var(--lp-ember)] [font-size:0.94em]">
                {hero.titleAccent}
              </span>
            </h1>
          </HeroItem>

          <HeroItem>
            <p className="mx-auto mt-3 max-w-[520px] text-[14px] font-medium leading-[1.6] text-[#514c43] sm:mt-4 sm:text-[15px]">
              {hero.lead}
            </p>
          </HeroItem>

          <HeroItem>
            <div className="mt-4 flex flex-col items-center gap-2.5 sm:mt-5 sm:flex-row sm:gap-3">
              <Button
                size="lg"
                asChild
                className="landing-btn-primary h-10 px-5 text-[14px] font-medium shadow-[0_10px_28px_rgba(22,20,14,0.18)] sm:h-11 sm:px-6"
              >
                <Link href="/signup">
                  {hero.cta}
                  <ArrowRight className="ms-1.5 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="landing-btn-secondary h-10 px-5 text-[14px] font-medium sm:h-11 sm:px-6"
              >
                <Link href="/skyline-lounge/demo-table-8">
                  <Play className="me-1.5 size-4" />
                  {hero.ctaSecondary}
                </Link>
              </Button>
            </div>
          </HeroItem>

          <HeroItem>
            <p className="mt-2.5 text-[11px] text-[var(--lp-subtle)] sm:text-[12px]">
              {hero.meta}
            </p>
          </HeroItem>
        </HeroStagger>

        <HeroItem className="mx-auto w-full max-w-[1140px] shrink-0">
          <div className="landing-hero-product-shell overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_28px_90px_-34px_rgba(22,20,14,0.34)]">
            <LandingHeroDenisDemo frameless compact />
          </div>
        </HeroItem>
      </LandingContainer>
    </section>
  );
}
