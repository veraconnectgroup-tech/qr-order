"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { HeroItem, HeroStagger } from "@/components/landing/animate-in-view";
import { LandingHeroDenisDemo } from "@/components/landing/landing-hero-denis-demo";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { Button } from "@/components/ui/button";

/**
 * NIMT layout: one viewport, three layers.
 * 1. Terrace full-bleed + white wash at top
 * 2. Copy centered in upper zone (no solid block)
 * 3. Mockup docked to bottom edge (rounded top only)
 */
export function LandingHero() {
  const { copy } = useLandingCopy();
  const { hero } = copy;

  return (
    <section className="landing-hero relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--lp-bg)]">
      {/* Layer 1 — background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/landing/hero-terrace.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_90%]"
        />
        <div className="landing-hero-wash absolute inset-0" />
      </div>

      {/* Layer 2 — copy (upper zone, never overlaps mockup) */}
      <div className="relative z-20 shrink-0 px-6 pt-[4.75rem] text-center sm:pt-20">
        <HeroStagger className="mx-auto flex w-full max-w-[680px] flex-col items-center">
          <HeroItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)]/95 px-3 py-1 text-[12px] font-medium text-[var(--lp-muted)]">
              <Sparkles className="size-3.5 text-[var(--lp-ember)]" aria-hidden />
              {hero.eyebrow}
            </span>
          </HeroItem>

          <HeroItem>
            <h1 className="mt-4 font-display text-[clamp(2.375rem,5.5vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.04em] text-[var(--lp-ink)] sm:mt-5">
              {hero.title}
              <span className="landing-serif-accent block pt-1 font-normal text-[var(--lp-ember)] [font-size:1.02em]">
                {hero.titleAccent}
              </span>
            </h1>
          </HeroItem>

          <HeroItem>
            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.6] text-[var(--lp-muted)] sm:mt-5 sm:text-[16px]">
              {hero.lead}
            </p>
          </HeroItem>

          <HeroItem>
            <div className="mt-5 flex flex-col items-center gap-3 sm:mt-6 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                asChild
                className="landing-btn-primary h-11 px-6 text-[14px] font-medium shadow-[0_10px_28px_rgba(22,20,14,0.18)]"
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
            <p className="mt-3 text-[12px] text-[var(--lp-subtle)] sm:text-[13px]">
              {hero.meta}
            </p>
          </HeroItem>
        </HeroStagger>
      </div>

      {/* Layer 3 — mockup fills remaining height, flush to bottom (NIMT video dock) */}
      <div className="relative z-10 mt-auto flex min-h-0 flex-1 items-end justify-center px-4 pb-0 sm:px-6 lg:px-8">
        <div className="landing-hero-mockup-dock w-full max-w-[1080px]">
          <div className="landing-hero-mockup-frame overflow-hidden rounded-t-2xl border border-b-0 border-black/10 bg-white shadow-[0_-20px_70px_rgba(20,18,11,0.2)] sm:rounded-t-[1.25rem]">
            <LandingHeroDenisDemo frameless compact />
          </div>
        </div>
      </div>
    </section>
  );
}
