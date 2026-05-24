"use client";

import { AnimateInView } from "@/components/landing/animate-in-view";
import { LandingCtaBanner } from "@/components/landing/landing-cta-banner";
import { LandingFooter } from "@/components/landing/landing-footer";

export function LandingClosingShowcase() {
  return (
    <div className="relative z-[2] overflow-hidden border-t border-[var(--lp-border-subtle)]">
      <AnimateInView>
        <LandingCtaBanner />
      </AnimateInView>
      <LandingFooter />
    </div>
  );
}
