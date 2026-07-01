"use client";

import { LandingContainer } from "@/components/landing/landing-primitives";
import { TrustLogoList } from "@/components/landing/trust-logos";
import { useLandingCopy } from "@/components/landing/landing-locale-provider";

export function LandingTrustStrip() {
  const { copy } = useLandingCopy();

  return (
    <section
      aria-label="Integrations and compliance"
      className="border-y border-white/[0.06] bg-black py-6"
    >
      <LandingContainer wide>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
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
