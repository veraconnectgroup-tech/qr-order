"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { Button } from "@/components/ui/button";

export function LandingCtaBanner() {
  const { copy } = useLandingCopy();
  const { ctaBanner } = copy;

  return (
    <section className="landing-cta-banner relative w-full overflow-hidden border-y border-[#1e1e2e] py-16 text-center sm:py-20">
      <div className="landing-cta-banner-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        {[0, 1, 2].map((ring) => (
          <div
            key={ring}
            className="landing-cta-ripple absolute size-64 rounded-full border border-[var(--qr-ember)]/20"
            style={{ animationDelay: `${ring * 1.2}s` }}
          />
        ))}
      </div>

      <div className="relative z-10 px-6">
        <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em] text-white">
          {ctaBanner.title}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-zinc-400">
          {ctaBanner.lead}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="h-12 min-w-[200px] rounded-full bg-[var(--qr-ember)] px-8 text-[15px] font-semibold text-white hover:bg-[var(--qr-ember-hover)]"
          >
            <Link href="/signup">
              {ctaBanner.primary}
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 min-w-[200px] rounded-full border-[#2a2a3e] bg-transparent px-8 text-[15px] font-medium text-zinc-200 hover:bg-[#12121a] hover:text-white"
          >
            <Link href="/skyline-lounge/demo-table-8">{ctaBanner.secondary}</Link>
          </Button>
        </div>

        <p className="mt-5 text-xs text-zinc-500">{ctaBanner.footnote}</p>
      </div>
    </section>
  );
}
