"use client";

import Link from "next/link";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";
import { Button } from "@/components/ui/button";

/** Full-viewport mission control — product first, typography as system layer. */
export function LandingHero() {
  return (
    <section
      id="system"
      className="relative scroll-mt-14 border-b border-zinc-800/80 bg-[#08080c] pt-14"
    >
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-2.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-zinc-600">
          <span>denis.app</span>
          <span className="text-zinc-800">/</span>
          <span className="truncate text-zinc-500">operations</span>
        </div>
        <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" aria-hidden />
          Skyline Lounge
        </p>
      </div>

      <div className="relative min-h-[calc(100dvh-7rem)] lg:min-h-[calc(100vh-6.5rem)]">
        <LandingHeroVisual fullBleed className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-[#08080c]/95 px-6 pb-8 pt-16 backdrop-blur-[2px] lg:px-8 lg:pb-10">
          <div className="pointer-events-auto max-w-[720px] border-t border-zinc-800/60 pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              Denis · Part of Vera Group
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.875rem,3.5vw,3rem)] font-medium leading-[1.1] tracking-[-0.035em] text-white">
              Mission control for hospitality operations.
            </h1>
            <p className="mt-3 max-w-[520px] text-[14px] leading-[1.65] text-zinc-500">
              Ordering, kitchen, floor coordination, payments, and compliance — one
              operating environment.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button
                size="sm"
                asChild
                className="h-9 rounded-md bg-[var(--qr-ember)] px-5 text-[13px] font-medium text-white hover:bg-[var(--qr-ember-hover)]"
              >
                <Link href="/signup">Open Denis</Link>
              </Button>
              <Link
                href="/login"
                className="text-[13px] text-zinc-500 transition hover:text-zinc-300"
              >
                Sign in
              </Link>
              <span className="hidden text-[12px] text-zinc-700 sm:inline">
                €0 / month · KassenSichV · &lt;30 min to live
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
