"use client";

import dynamic from "next/dynamic";
import { LandingCtaBanner } from "@/components/landing/landing-cta-banner";
import { LandingDocumentHead } from "@/components/landing/landing-document-head";
import { LandingEnterprisePreview } from "@/components/landing/landing-enterprise-preview";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import {
  LandingLocaleProvider,
} from "@/components/landing/landing-locale-provider";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingSocialProof } from "@/components/landing/landing-social-proof";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";

const LandingFeatures = dynamic(
  () =>
    import("@/components/landing/landing-features").then((m) => ({
      default: m.LandingFeatures,
    })),
  {
    loading: () => (
      <div
        className="scroll-mt-24 border-t border-[var(--lp-border-subtle)] bg-[var(--lp-bg)] py-20 md:py-28"
        aria-hidden
      >
        <div className="mx-auto h-[640px] max-w-[1080px] animate-pulse rounded-2xl bg-black/[0.03]" />
      </div>
    ),
  }
);

function LandingPageContent() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden antialiased">
      <LandingDocumentHead />
      <LandingNav />

      <main className="relative z-[2]" id="main-content">
        <LandingHero />
        <LandingTrustStrip />
        <LandingFeatures />
        <LandingSocialProof />
        <LandingEnterprisePreview />
        <LandingPricing />
        <LandingFaq />
        <LandingCtaBanner />
      </main>

      <LandingFooter />
    </div>
  );
}

export function LandingPage() {
  return (
    <LandingLocaleProvider>
      <LandingPageContent />
    </LandingLocaleProvider>
  );
}
