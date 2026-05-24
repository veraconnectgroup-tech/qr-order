"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingCtaBanner } from "@/components/landing/landing-cta-banner";
import { LandingFooter } from "@/components/landing/landing-footer";

export function LandingClosingShowcase() {
  return (
    <div className="relative z-[2] overflow-hidden border-t border-[#1e1e2e] bg-black">
      <div className="landing-glow-bottom pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_72%,rgba(99,102,241,0.12),transparent_70%)]"
        aria-hidden
      />

      <AnimateInView>
        <LandingCtaBanner />
      </AnimateInView>

      <LandingFooter />
    </div>
  );
}
