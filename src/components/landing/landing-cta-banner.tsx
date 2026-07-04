"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingContainer } from "@/components/landing/landing-primitives";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { Button } from "@/components/ui/button";

export function LandingCtaBanner() {
  const { copy } = useLandingCopy();
  const { ctaBanner } = copy;

  return (
    <section className="relative w-full overflow-hidden border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-16 text-[var(--lp-ink)] sm:py-20">
      <LandingContainer wide>
        <div className="mx-auto grid max-w-[1140px] items-center overflow-hidden rounded-lg border border-[var(--lp-ember)]/25 bg-[var(--lp-ember)] text-white shadow-[0_34px_90px_-66px_rgba(232,93,4,0.75)] lg:grid-cols-[1fr_auto]">
          <div className="px-8 py-10 sm:px-10 lg:px-12">
            <p className="text-[11px] font-semibold uppercase tracking-normal text-white/68">
              Denis AI Restaurant Co-worker
            </p>
            <h2 className="mt-4 max-w-[34rem] font-display text-[clamp(1.75rem,3.4vw,2.65rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              {ctaBanner.title}
            </h2>
            <p className="mt-4 max-w-[38rem] text-[16px] leading-relaxed text-white/78">
              {ctaBanner.lead}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/18 bg-black/[0.035] px-8 py-8 sm:flex-row sm:px-10 lg:flex-col lg:border-l lg:border-t-0 lg:px-12">
            <Button
              size="lg"
              asChild
              className="h-11 min-w-[190px] rounded-full !border-white/12 !bg-[#16140e] px-6 text-[14px] font-medium !text-white shadow-[0_18px_44px_-26px_rgba(22,20,14,0.82)] hover:!bg-[#2c2920]"
            >
              <Link href="/signup">
                {ctaBanner.primary}
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              asChild
              className="h-11 min-w-[190px] rounded-full !border-white/28 !bg-white/10 px-6 text-[14px] font-medium !text-white backdrop-blur hover:!bg-white/16"
            >
              <Link href="/skyline-lounge/demo-table-8">{ctaBanner.secondary}</Link>
            </Button>
            <p className="max-w-[14rem] text-[12px] leading-relaxed text-white/66">
              {ctaBanner.footnote}
            </p>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
