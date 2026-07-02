"use client";

import { LandingContainer } from "@/components/landing/landing-primitives";
import { TrustLogoList } from "@/components/landing/trust-logos";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";

export function LandingTrustStrip() {
  const { copy } = useLandingCopy();

  return (
    <section
      aria-label="Integrations and compliance"
      className="border-y border-[var(--lp-border-subtle)] bg-[var(--lp-surface)] py-8 md:py-10"
    >
      <LandingContainer wide>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--lp-subtle)]">
          {copy.trust}
        </p>

        <ul className="mt-6 flex gap-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          <TrustLogoList />
        </ul>

        <ul className="mt-6 hidden flex-wrap items-center justify-center gap-x-10 gap-y-4 md:flex">
          <TrustLogoList />
        </ul>
      </LandingContainer>
    </section>
  );
}
