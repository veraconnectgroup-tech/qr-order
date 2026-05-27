"use client";

import Link from "next/link";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { Button } from "@/components/ui/button";

/** Enter the operating environment — product first, calm editorial type. */
export function LandingHero() {
  return (
    <section
      id="system"
      className="relative overflow-hidden scroll-mt-14 border-b border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] pt-14"
    >
      <div className="flex items-center justify-between border-b border-[var(--lp-border-subtle)] px-6 py-2.5 lg:px-8">
        <p className="landing-meta font-mono">
          denis.app / operations
        </p>
        <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--lp-muted)]">
          <span className="size-1.5 rounded-full bg-emerald-500/90 pulse-dot" aria-hidden />
          Skyline Lounge
        </p>
      </div>

      <div className="relative min-h-[calc(100dvh-7rem)] lg:min-h-[calc(100vh-6.5rem)]">
        <LandingHeroVisual fullBleed className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[var(--lp-bg)] via-[var(--lp-bg)]/92 to-transparent px-6 pb-10 pt-24 lg:px-8 lg:pb-12">
          <div className="pointer-events-auto max-w-[640px] border-t border-[var(--lp-border-subtle)] pt-8">
            <p className="landing-meta uppercase tracking-[0.14em]">
              Denis · Part of Vera Group
            </p>
            <h1 className="landing-display mt-4">
              Coordinated hospitality operations.
            </h1>
            <p className="landing-lead mt-4 max-w-[480px]">
              Service timing, floor awareness, and guest flow — one calm
              environment for serious venues.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
              <Button
                size="sm"
                asChild
                className="h-9 rounded-md bg-[var(--lp-ember)] px-5 text-[13px] font-medium text-white hover:bg-[var(--lp-ember-hover)]"
              >
                <Link href="/signup">Open Denis</Link>
              </Button>
              <Link
                href="/login"
                className="text-[13px] text-[var(--lp-muted)] transition hover:text-[var(--lp-ink)]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
