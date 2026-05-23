"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingCtaBanner } from "@/components/landing/landing-cta-banner";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingContainer } from "@/components/landing/landing-primitives";

export function LandingClosingShowcase() {
  return (
    <div className="relative overflow-hidden border-t border-zinc-800 bg-black">
      <div className="landing-glow-bottom pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_72%,rgba(234,88,12,0.16),transparent_70%)]"
        aria-hidden
      />

      <section className="relative px-6 py-16 md:py-20">
        <LandingContainer wide>
          <AnimateInView>
            <LandingCtaBanner />
          </AnimateInView>
        </LandingContainer>
      </section>

      <LandingFooter />
    </div>
  );
}
