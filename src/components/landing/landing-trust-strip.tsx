"use client";

import { LandingContainer } from "@/components/landing/landing-primitives";
import { TrustLogoList } from "@/components/landing/trust-logos";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";

export function LandingTrustStrip() {
  const { copy } = useLandingCopy();

  return (
    <section
      aria-label="Integrations and compliance"
      className="border-y border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-6"
    >
      <LandingContainer wide>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--lp-subtle)]">
          {copy.trust}
        </p>

        <ul className="mt-5 flex gap-3 overflow-x-auto pb-1 md:hidden">
          <TrustLogoList />
        </ul>

        <ul className="mt-5 hidden flex-wrap items-center justify-center gap-3 md:flex">
          <TrustLogoList />
        </ul>
      </LandingContainer>
    </section>
  );
}
