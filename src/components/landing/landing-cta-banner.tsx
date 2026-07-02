"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";
import { Button } from "@/components/ui/button";

export function LandingCtaBanner() {
  const { copy } = useLandingCopy();
  const { ctaBanner } = copy;

  return (
    <section className="relative w-full overflow-hidden border-t border-[var(--lp-border-subtle)] py-20 text-center sm:py-28">
      <Image
        src="/landing/cta-watercolor.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        aria-hidden
      />
      {/* Soft wash so copy stays readable on the painting */}
      <div
        className="absolute inset-0 bg-[var(--lp-bg)]/60"
        aria-hidden
      />

      <div className="relative z-10 px-6">
        <h2 className="font-display text-[clamp(1.875rem,4.4vw,2.875rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--lp-ink)]">
          {ctaBanner.title}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--lp-muted)]">
          {ctaBanner.lead}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="landing-btn-primary h-11 min-w-[180px] px-6 text-[14px] font-medium"
          >
            <Link href="/signup">
              {ctaBanner.primary}
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            asChild
            className="landing-btn-secondary h-11 min-w-[180px] px-6 text-[14px] font-medium backdrop-blur-sm"
          >
            <Link href="/skyline-lounge/demo-table-8">{ctaBanner.secondary}</Link>
          </Button>
        </div>

        <p className="mt-5 text-xs text-[var(--lp-subtle)]">{ctaBanner.footnote}</p>
      </div>
    </section>
  );
}
